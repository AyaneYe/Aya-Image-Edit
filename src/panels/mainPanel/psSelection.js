function toIntBounds(bounds) {
  const left = Math.floor(bounds.left);
  const top = Math.floor(bounds.top);
  const right = Math.ceil(bounds.right);
  const bottom = Math.ceil(bounds.bottom);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}

export function getSelectionBounds() {
  const photoshop = require("photoshop");
  const { app } = photoshop;

  const doc = app.activeDocument;
  const sel = doc?.selection?.bounds;
  if (!sel) throw new Error("请先在 Photoshop 中框选一个选区");
  const b = toIntBounds(sel);
  return { left: b.left, top: b.top, width: b.width, height: b.height };
}

function rgbaToRgbOverWhite(rgba) {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3] / 255;
    rgb[j + 0] = Math.round(rgba[i + 0] * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(rgba[i + 2] * a + 255 * (1 - a));
  }
  return rgb;
}

async function encodeImageDataBase64({ imaging, imageData, format }) {
  const bytesToBase64 = (bytes) => {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

    if (typeof Buffer !== "undefined") {
      return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString("base64");
    }

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < view.length; i += chunk) {
      const slice = view.subarray(i, i + chunk);
      binary += String.fromCharCode(...slice);
    }
    if (typeof btoa !== "function") {
      throw new Error("当前环境不支持二进制到 base64 编码");
    }
    return btoa(binary);
  };

  const normalizeBase64 = (encoded) => {
    if (typeof encoded === "string") {
      return encoded.includes(",") ? encoded.split(",")[1] : encoded;
    }

    const payload = encoded?.data ?? encoded;
    if (typeof payload === "string") {
      return payload.includes(",") ? payload.split(",")[1] : payload;
    }

    if (payload instanceof ArrayBuffer) return bytesToBase64(new Uint8Array(payload));
    if (ArrayBuffer.isView(payload)) {
      return bytesToBase64(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength));
    }

    throw new Error("encodeImageData returned unsupported payload type");
  };

  const tryCalls = [
    async () => imaging.encodeImageData({ imageData, format, base64: true }),
    async () => imaging.encodeImageData(imageData, { format, base64: true }),
    async () => imaging.encodeImageData({ imageData, format })
  ];

  let lastError = null;
  for (const fn of tryCalls) {
    try {
      const encoded = await fn();
      const base64 = normalizeBase64(encoded);
      if (!base64 || typeof base64 !== "string") {
        throw new Error("encodeImageData returned empty result");
      }
      return base64.replace(/\s+/g, "");
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("encodeImageData failed");
}

export async function selectionToImageBase64() {
  const photoshop = require("photoshop");
  const { app, core, imaging } = photoshop;

  if (!imaging) throw new Error("当前 Photoshop UXP 环境不支持 imaging API");

  const { bounds, rgbaBuffer } = await core.executeAsModal(
    async () => {
      const doc = app.activeDocument;
      const sel = doc?.selection?.bounds;
      if (!sel) throw new Error("请先在 Photoshop 中框选一个选区");

      const b = toIntBounds(sel);

      const pxObj = await imaging.getPixels({
        documentID: doc.id,
        sourceBounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1",
        componentSize: 8
      });

      let maskObj = null;
      try {
        maskObj = await imaging.getSelection({
          documentID: doc.id,
          sourceBounds: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }
        });
      } catch {
        maskObj = null;
      }

      const pixelData = await pxObj.imageData.getData({ chunky: true });
      const pixelComponents = pxObj.imageData.components;
      const maskData = maskObj ? await maskObj.imageData.getData({ chunky: true }) : null;

      const out = new Uint8ClampedArray(b.width * b.height * 4);
      for (let i = 0; i < b.width * b.height; i++) {
        const m = maskData ? maskData[i] ?? 0 : 255;
        if (pixelComponents === 4) {
          const r = pixelData[i * 4 + 0];
          const g = pixelData[i * 4 + 1];
          const bl = pixelData[i * 4 + 2];
          const a = pixelData[i * 4 + 3];
          out[i * 4 + 0] = r;
          out[i * 4 + 1] = g;
          out[i * 4 + 2] = bl;
          out[i * 4 + 3] = Math.round((a * m) / 255);
        } else {
          out[i * 4 + 0] = pixelData[i * 3 + 0];
          out[i * 4 + 1] = pixelData[i * 3 + 1];
          out[i * 4 + 2] = pixelData[i * 3 + 2];
          out[i * 4 + 3] = m;
        }
      }

      pxObj.imageData.dispose();
      if (maskObj) maskObj.imageData.dispose();

      return {
        bounds: { left: b.left, top: b.top, width: b.width, height: b.height },
        rgbaBuffer: out.buffer
      };
    },
    { commandName: "Read Selection" }
  );

  const result = await core.executeAsModal(
    async () => {
      if (typeof imaging.encodeImageData !== "function") {
        throw new Error("当前环境不支持图像编码（缺少 imaging.encodeImageData）");
      }

      const rgba = new Uint8Array(rgbaBuffer);

      // 1) Try PNG with alpha
      let imageData = await imaging.createImageDataFromBuffer(rgba, {
        width: bounds.width,
        height: bounds.height,
        components: 4,
        chunky: true,
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1"
      });

      try {
        const base64 = await encodeImageDataBase64({ imaging, imageData, format: "png" });
        return { mime: "image/png", base64 };
      } catch (e) {
        const msg = e?.message || String(e);
        if (!/alpha|jpeg|jpg/i.test(msg)) {
          throw e;
        }
      } finally {
        imageData.dispose();
      }

      // 2) Fallback to JPEG without alpha
      const rgb = rgbaToRgbOverWhite(rgba);
      imageData = await imaging.createImageDataFromBuffer(rgb, {
        width: bounds.width,
        height: bounds.height,
        components: 3,
        chunky: true,
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1"
      });
      try {
        const base64 = await encodeImageDataBase64({ imaging, imageData, format: "jpeg" });
        return { mime: "image/jpeg", base64 };
      } finally {
        imageData.dispose();
      }
    },
    { commandName: "Encode Selection Image" }
  );

  return { bounds, mime: result.mime, base64: result.base64 };
}
