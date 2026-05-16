import { placeImageAtBoundsInHost } from "../../bridge/hostBridge.js";

export async function placeImageUrlAtBounds(imageUrl, bounds) {
  return placeImageAtBoundsInHost(imageUrl, bounds);
}
