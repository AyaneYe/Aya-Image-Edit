const photoshop = require("photoshop");
const uxp = require("uxp");

import {
  documentImageToBase64Host,
  downloadAndSaveImageHost,
  getSelectionBoundsHost,
  placeImageUrlAtBoundsHost,
  readSettingsFromDiskHost,
  runAddNeutralGrayLayerHost,
  runRemoveBlemishRetouchHost,
  runSetSoftWhiteBrushHost,
  selectionToImageBase64Host,
  writeSettingsToDiskHost,
} from "./imageEditRuntime.js";

const shell = uxp.shell;

let activeWebview = null;
let bridgeListener = null;
let bridgeListenerInstalled = false;
let photoshopDocumentListener = null;
let photoshopDocumentListenerInstalled = false;
let photoshopDocumentListenerEvents = null;
let photoshopDocumentChangeTimer = null;

const PHOTOSHOP_DOCUMENT_EVENTS = [
  "historyStateChanged",
  "select",
  "set",
  "make",
  "delete",
  "move",
  "transform",
  "paste",
  "clear",
  "crop",
];

const PHOTOSHOP_DOCUMENT_EVENT_FALLBACK = ["all"];

function bridgeHostLog(level, message, payload) {
  const fn = console[level] || console.log;
  if (typeof payload === "undefined") {
    fn(`[AyaImageEdit][bridge-host] ${message}`);
    return;
  }
  fn(`[AyaImageEdit][bridge-host] ${message}`, payload);
}

function serializeBridgeError(error) {
  return {
    message: error?.message || String(error),
    details:
      typeof error?.details === "string" && error.details.trim() ? error.details.trim() : "",
    stack: error?.stack || "",
  };
}

function sendToWebview(payload) {
  if (!activeWebview || typeof activeWebview.postMessage !== "function") {
    bridgeHostLog("warn", "cannot send message back to WebView because postMessage is unavailable", payload);
    return;
  }

  try {
    activeWebview.postMessage(payload);
  } catch (error) {
    bridgeHostLog(
      "error",
      "failed to post bridge response",
      error?.stack || error?.message || String(error)
    );
  }
}

function sendBridgeEvent(eventName, payload = {}) {
  sendToWebview({
    bridge: "aya-image-edit",
    type: "event",
    event: eventName,
    payload,
  });
}

function getPhotoshopNotificationName(event, descriptor) {
  if (typeof event === "string") {
    return event;
  }

  return (
    event?.event ||
    event?.eventName ||
    event?._obj ||
    descriptor?._obj ||
    descriptor?.command ||
    ""
  );
}

function shouldForwardPhotoshopDocumentEvent(eventName) {
  if (!eventName) {
    return true;
  }

  return /history|select|set|make|delete|move|transform|paste|clear|crop|resize|canvas|image|layer|modal/i.test(
    String(eventName)
  );
}

function schedulePhotoshopDocumentChange(eventName) {
  if (photoshopDocumentChangeTimer) {
    clearTimeout(photoshopDocumentChangeTimer);
  }

  photoshopDocumentChangeTimer = setTimeout(() => {
    photoshopDocumentChangeTimer = null;
    sendBridgeEvent("ps.documentChanged", {
      eventName: String(eventName || ""),
      timestamp: Date.now(),
    });
  }, 80);
}

function tryInstallPhotoshopDocumentListener(events) {
  try {
    const result = photoshop.action.addNotificationListener(events, photoshopDocumentListener);
    photoshopDocumentListenerInstalled = true;
    photoshopDocumentListenerEvents = events;

    if (result && typeof result.catch === "function") {
      result.catch((error) => {
        bridgeHostLog(
          "warn",
          "failed to install Photoshop notification listener",
          error?.message || String(error)
        );
        if (photoshopDocumentListenerEvents === events) {
          photoshopDocumentListenerInstalled = false;
          photoshopDocumentListenerEvents = null;
          if (events !== PHOTOSHOP_DOCUMENT_EVENT_FALLBACK) {
            tryInstallPhotoshopDocumentListener(PHOTOSHOP_DOCUMENT_EVENT_FALLBACK);
          }
        }
      });
    }

    return true;
  } catch (error) {
    bridgeHostLog(
      "warn",
      "failed to install Photoshop notification listener",
      error?.message || String(error)
    );
    return false;
  }
}

function setupPhotoshopDocumentNotifications() {
  if (photoshopDocumentListenerInstalled || photoshopDocumentListener) {
    return;
  }

  if (typeof photoshop?.action?.addNotificationListener !== "function") {
    bridgeHostLog("warn", "Photoshop notification listener API is unavailable");
    return;
  }

  photoshopDocumentListener = (event, descriptor) => {
    const eventName = getPhotoshopNotificationName(event, descriptor);
    if (!shouldForwardPhotoshopDocumentEvent(eventName)) {
      return;
    }
    schedulePhotoshopDocumentChange(eventName);
  };

  if (!tryInstallPhotoshopDocumentListener(PHOTOSHOP_DOCUMENT_EVENTS)) {
    tryInstallPhotoshopDocumentListener(PHOTOSHOP_DOCUMENT_EVENT_FALLBACK);
  }
}

function teardownPhotoshopDocumentNotifications() {
  if (photoshopDocumentChangeTimer) {
    clearTimeout(photoshopDocumentChangeTimer);
    photoshopDocumentChangeTimer = null;
  }

  if (
    photoshopDocumentListenerInstalled &&
    photoshopDocumentListener &&
    photoshopDocumentListenerEvents &&
    typeof photoshop?.action?.removeNotificationListener === "function"
  ) {
    try {
      photoshop.action.removeNotificationListener(
        photoshopDocumentListenerEvents,
        photoshopDocumentListener
      );
    } catch (error) {
      bridgeHostLog(
        "warn",
        "failed to remove Photoshop notification listener",
        error?.message || String(error)
      );
    }
  }

  photoshopDocumentListener = null;
  photoshopDocumentListenerInstalled = false;
  photoshopDocumentListenerEvents = null;
}

function createTimeoutSignal(timeoutMs) {
  const safeTimeout = Number(timeoutMs);
  if (!Number.isFinite(safeTimeout) || safeTimeout <= 0 || typeof AbortController === "undefined") {
    return {
      signal: undefined,
      cleanup() {},
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safeTimeout);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
    },
  };
}

async function fetchThroughHost(url, options = {}) {
  const { method = "GET", headers = {}, body, timeoutMs } = options || {};
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || "",
      body: await response.text(),
      contentType: response.headers?.get?.("content-type") || "",
    };
  } finally {
    cleanup();
  }
}

function stripMultipartContentType(headers = {}) {
  const cleanHeaders = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() !== "content-type") {
      cleanHeaders[key] = value;
    }
  }
  return cleanHeaders;
}

function decodeBase64ToBytes(base64) {
  const clean = String(base64 || "").replace(/\s+/g, "");

  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(clean, "base64");
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  throw new Error("当前运行时无法解码 multipart 文件数据。");
}

function assertMultipartField(field) {
  if (!field || typeof field !== "object" || typeof field.name !== "string" || !field.name) {
    throw new Error("multipart 字段描述无效：缺少 name。");
  }
}

function assertMultipartFile(file) {
  if (!file || typeof file !== "object" || typeof file.name !== "string" || !file.name) {
    throw new Error("multipart 文件描述无效：缺少 name。");
  }

  if (typeof file.base64 !== "string" || !file.base64.trim()) {
    throw new Error("multipart 文件描述无效：缺少 Base64 数据。");
  }
}

function buildMultipartFormData({ fields = [], files = [] }) {
  if (typeof FormData === "undefined" || typeof Blob === "undefined") {
    throw new Error("当前运行时无法构造 multipart 请求体。");
  }

  if (!Array.isArray(fields)) {
    throw new Error("multipart 字段描述无效：fields 必须是数组。");
  }

  if (!Array.isArray(files)) {
    throw new Error("multipart 文件描述无效：files 必须是数组。");
  }

  const formData = new FormData();

  for (const field of fields) {
    assertMultipartField(field);
    formData.append(field.name, String(field.value ?? ""));
  }

  for (const file of files) {
    assertMultipartFile(file);
    const bytes = decodeBase64ToBytes(file.base64);
    const mimeType = file.mimeType || "application/octet-stream";
    const blob = new Blob([bytes], { type: mimeType });
    formData.append(file.name, blob, file.fileName || "file");
  }

  return formData;
}

async function fetchMultipartThroughHost(url, options = {}) {
  const { method = "POST", headers = {}, timeoutMs } = options || {};
  const { signal, cleanup } = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: stripMultipartContentType(headers),
      body: buildMultipartFormData(options),
      signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText || "",
      body: await response.text(),
      contentType: response.headers?.get?.("content-type") || "",
    };
  } finally {
    cleanup();
  }
}

async function getRuntimeInfo() {
  return {
    bridge: "aya-image-edit",
    timestamp: new Date().toISOString(),
    hasWebviewHost: Boolean(activeWebview),
  };
}

async function getPhotoshopInfo() {
  const app = photoshop.app;
  const activeDocument = app?.activeDocument || null;

  return {
    application: "Adobe Photoshop",
    version: app?.version || null,
    activeDocumentId: activeDocument?.id || null,
    activeDocumentTitle: activeDocument?.title || activeDocument?.name || null,
  };
}

async function handleBridgeCall(method, args) {
  switch (method) {
    case "bridge.ping":
      return {
        ok: true,
        timestamp: Date.now(),
      };
    case "runtime.getInfo":
      return getRuntimeInfo();
    case "settings.read":
      return readSettingsFromDiskHost();
    case "settings.write":
      await writeSettingsToDiskHost(args[0]);
      return true;
    case "storage.saveGeneratedImage":
      return downloadAndSaveImageHost(args[0]);
    case "ps.getInfo":
      return getPhotoshopInfo();
    case "ps.getSelectionBounds":
      return getSelectionBoundsHost();
    case "ps.selectionToImageBase64":
      return selectionToImageBase64Host();
    case "ps.canvasToImageBase64":
      return documentImageToBase64Host({ source: "canvas" });
    case "ps.layerToImageBase64":
      return documentImageToBase64Host({ source: "layer" });
    case "ps.placeImageAtBounds":
      return placeImageUrlAtBoundsHost(args[0], args[1]);
    case "ps.retouchRemoveBlemish":
      return runRemoveBlemishRetouchHost();
    case "ps.retouchAddNeutralGrayLayer":
      return runAddNeutralGrayLayerHost();
    case "ps.retouchSetSoftWhiteBrush":
      return runSetSoftWhiteBrushHost();
    case "ps.batchPlay":
      return photoshop.action.batchPlay(args[0] || [], args[1] || {});
    case "network.fetch":
      return fetchThroughHost(args[0], args[1] || {});
    case "network.fetchMultipart":
      return fetchMultipartThroughHost(args[0], args[1] || {});
    case "shell.openExternal":
      return shell.openExternal(String(args[0] || ""));
    default:
      throw new Error(`未知的桥接方法：${method}`);
  }
}

export function setupBridge(webviewEl) {
  activeWebview = webviewEl;
  bridgeHostLog("info", "bridge setup requested", {
    hasPostMessage: typeof webviewEl?.postMessage === "function",
    source: webviewEl?.getAttribute?.("src") || "",
  });
  setupPhotoshopDocumentNotifications();

  if (!bridgeListener) {
    bridgeListener = async (event) => {
      if (activeWebview && event?.source && event.source !== activeWebview) {
        return;
      }

      const data = event?.data;
      if (!data || typeof data !== "object") {
        return;
      }

      const { id, method, args = [] } = data;
      const idType = typeof id;
      if ((idType !== "string" && idType !== "number") || typeof method !== "string") {
        return;
      }

      try {
        bridgeHostLog("info", "received bridge call", { id, method });
        const result = await handleBridgeCall(method, args);
        sendToWebview({ id, result });
      } catch (error) {
        const serializedError = serializeBridgeError(error);
        bridgeHostLog("error", "bridge call failed", {
          id,
          method,
          message: serializedError.message,
          details: serializedError.details,
          stack: serializedError.stack,
        });
        sendToWebview({
          id,
          error: serializedError,
        });
      }
    };
  }

  if (!bridgeListenerInstalled) {
    window.addEventListener("message", bridgeListener);
    bridgeListenerInstalled = true;
    bridgeHostLog("info", "host window bridge listener installed");
  }
}

export function teardownBridge() {
  if (bridgeListenerInstalled && bridgeListener) {
    window.removeEventListener("message", bridgeListener);
  }
  teardownPhotoshopDocumentNotifications();

  activeWebview = null;
  bridgeListener = null;
  bridgeListenerInstalled = false;
}
