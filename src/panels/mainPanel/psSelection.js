import {
  captureCanvasFromHost,
  captureLayerFromHost,
  captureSelectionFromHost,
  getSelectionBoundsFromHost,
} from "../../bridge/hostBridge.js";

export async function getSelectionBounds() {
  return getSelectionBoundsFromHost();
}

export async function selectionToImageBase64() {
  return captureSelectionFromHost();
}

export async function canvasToImageBase64() {
  return captureCanvasFromHost();
}

export async function layerToImageBase64() {
  return captureLayerFromHost();
}
