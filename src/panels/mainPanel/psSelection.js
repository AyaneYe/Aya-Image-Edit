import {
  captureSelectionFromHost,
  getSelectionBoundsFromHost,
} from "../../bridge/hostBridge.js";

export async function getSelectionBounds() {
  return getSelectionBoundsFromHost();
}

export async function selectionToImageBase64() {
  return captureSelectionFromHost();
}
