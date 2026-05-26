import { invoke, isInWebView } from "./uxpBridge.js";

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

export function isHostBridgeAvailable() {
  return isInWebView();
}
