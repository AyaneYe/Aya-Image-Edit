import { invoke, isInWebView, subscribeHostEvent } from "./uxpBridge.js";

export function invokeHost(method, ...args) {
  return invoke(method, ...args);
}

export async function hostFetch(url, options = {}) {
  if (isInWebView()) {
    return invokeHost("network.fetch", url, options);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText || "",
    body: await response.text(),
    contentType: response.headers?.get?.("content-type") || "",
  };
}


// Like hostFetch but routes through network.fetchResponses on the host side,
// which forces stream:true and parses SSE so UXP's idle-timeout never fires.
export async function hostFetchResponses(url, options = {}) {
  if (isInWebView()) {
    return invokeHost("network.fetchResponses", url, options);
  }

  // Dev-mode fallback: plain fetch (CORS may block cross-origin requests)
  const response = await fetch(url, {
    method: options.method || "POST",
    headers: options.headers || {},
    body: options.body,
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText || "",
    body: await response.text(),
    contentType: response.headers?.get?.("content-type") || "",
  };
}

export async function hostFetchJson(url, options = {}) {
  const response = await hostFetch(url, options);
  let json = {};

  if (typeof response.body === "string" && response.body.trim()) {
    try {
      json = JSON.parse(response.body);
    } catch {
      json = {};
    }
  }

  return {
    ...response,
    json,
  };
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

function base64ToBlob(base64, mimeType) {
  if (typeof atob !== "function" || typeof Blob === "undefined") {
    throw new Error("当前运行时无法构造 multipart 图片文件。");
  }

  const binary = atob(String(base64 || "").replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function buildMultipartFormData({ fields = [], files = [] }) {
  const formData = new FormData();

  for (const field of fields) {
    formData.append(String(field.name), String(field.value ?? ""));
  }

  for (const file of files) {
    const blob = base64ToBlob(file.base64, file.mimeType || "application/octet-stream");
    formData.append(String(file.name), blob, file.fileName || "file");
  }

  return formData;
}

export async function hostFetchMultipart(url, options = {}) {
  if (isInWebView()) {
    return invokeHost("network.fetchMultipart", url, options);
  }

  const response = await fetch(url, {
    method: options.method || "POST",
    headers: stripMultipartContentType(options.headers),
    body: buildMultipartFormData(options),
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText || "",
    body: await response.text(),
    contentType: response.headers?.get?.("content-type") || "",
  };
}

export function readSettingsFromHost() {
  return invokeHost("settings.read");
}

export function writeSettingsToHost(settings) {
  return invokeHost("settings.write", settings);
}

export function saveGeneratedImageToHost(imageUrl) {
  return invokeHost("storage.saveGeneratedImage", imageUrl);
}

export function getSelectionBoundsFromHost() {
  return invokeHost("ps.getSelectionBounds");
}

export function captureSelectionFromHost() {
  return invokeHost("ps.selectionToImageBase64");
}

export function captureCanvasFromHost() {
  return invokeHost("ps.canvasToImageBase64");
}

export function captureLayerFromHost() {
  return invokeHost("ps.layerToImageBase64");
}

export function placeImageAtBoundsInHost(imageUrl, bounds) {
  return invokeHost("ps.placeImageAtBounds", imageUrl, bounds);
}

export function runRemoveBlemishRetouchInHost() {
  return invokeHost("ps.retouchRemoveBlemish");
}

export function runAddNeutralGrayLayerInHost() {
  return invokeHost("ps.retouchAddNeutralGrayLayer");
}

export function runSetSoftWhiteBrushInHost() {
  return invokeHost("ps.retouchSetSoftWhiteBrush");
}

export function subscribePhotoshopDocumentChange(handler) {
  return subscribeHostEvent("ps.documentChanged", handler);
}

export function isHostBridgeAvailable() {
  return isInWebView();
}
