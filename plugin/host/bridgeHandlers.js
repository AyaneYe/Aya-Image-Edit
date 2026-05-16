const photoshop = require("photoshop");
const uxp = require("uxp");

import {
  downloadAndSaveImageHost,
  getSelectionBoundsHost,
  placeImageUrlAtBoundsHost,
  readSettingsFromDiskHost,
  selectionToImageBase64Host,
  writeSettingsToDiskHost,
} from "./imageEditRuntime.js";

const shell = uxp.shell;

let activeWebview = null;
let bridgeListener = null;
let bridgeListenerInstalled = false;

function bridgeHostLog(level, message, payload) {
  const fn = console[level] || console.log;
  if (typeof payload === "undefined") {
    fn(`[AyaImageEdit][bridge-host] ${message}`);
    return;
  }
  fn(`[AyaImageEdit][bridge-host] ${message}`, payload);
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
    case "ps.placeImageAtBounds":
      return placeImageUrlAtBoundsHost(args[0], args[1]);
    case "ps.batchPlay":
      return photoshop.action.batchPlay(args[0] || [], args[1] || {});
    case "network.fetch":
      return fetchThroughHost(args[0], args[1] || {});
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
        bridgeHostLog("error", "bridge call failed", {
          id,
          method,
          message: error?.message || String(error),
          stack: error?.stack || "",
        });
        sendToWebview({
          id,
          error: {
            message: error?.message || String(error),
          },
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

  activeWebview = null;
  bridgeListener = null;
  bridgeListenerInstalled = false;
}
