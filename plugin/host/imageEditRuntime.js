import { defaultSettings } from "../../src/panels/mainPanel/sharedSettings.js";

const SETTINGS_FILE_NAME = "settings.json";

export async function readSettingsFromDiskHost() {
  try {
    const uxp = require("uxp");
    const fs = uxp.storage.localFileSystem;
    const folder = await fs.getDataFolder();

    let file = null;
    try {
      file = await folder.getEntry(SETTINGS_FILE_NAME);
    } catch {
      return defaultSettings;
    }

    const raw = await file.read();
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function writeSettingsToDiskHost(settings) {
  try {
    const uxp = require("uxp");
    const fs = uxp.storage.localFileSystem;
    const folder = await fs.getDataFolder();
    const file = await folder.createFile(SETTINGS_FILE_NAME, { overwrite: true });
    await file.write(JSON.stringify(settings, null, 2));
    return true;
  } catch {
    return false;
  }
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

  throw new Error("当前运行时无法解码 Base64 图片数据。");
}

function tryDataUrlToArrayBuffer(url) {
  if (typeof url !== "string" || !url.startsWith("data:")) {
    return null;
  }

  const commaIndex = url.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("图片 Data URL 无效。");
  }

  const meta = url.slice(5, commaIndex);
  const payload = url.slice(commaIndex + 1);

  if (/;base64/i.test(meta)) {
    const bytes = decodeBase64ToBytes(payload);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index) & 0xff;
  }
  return bytes.buffer;
}

async function fetchArrayBuffer(url) {
  const dataBuffer = tryDataUrlToArrayBuffer(url);
  if (dataBuffer) {
    return dataBuffer;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 30000);

  try {
    const response = await fetch(url, {
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`请求失败：${response.status} ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadAndSaveImageHost(url) {
  const uxp = require("uxp");
  const fs = uxp.storage.localFileSystem;
  const formats = uxp.storage.formats;
  const buffer = await fetchArrayBuffer(url);

  try {
    const file = await fs.getFileForSaving(`aya-result-${Date.now()}.png`);
    if (!file) {
      return { saved: false, reason: "canceled" };
    }
    await file.write(buffer, { format: formats.binary });
    return {
      saved: true,
      target: file.nativePath || file.name,
    };
  } catch (error) {
    const message = error?.message || String(error);
    if (/not permitted|file picker|Manifest entry not found/i.test(message)) {
      throw new Error(
        "插件没有打开保存对话框的权限，请确认 manifest 权限后重新加载插件。"
      );
    }
    throw error;
  }
}

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
    height: Math.max(1, bottom - top),
  };
}

export function getSelectionBoundsHost() {
  const photoshop = require("photoshop");
  const { app } = photoshop;

  const documentRef = app.activeDocument;
  const selectionBounds = documentRef?.selection?.bounds;
  if (!selectionBounds) {
    throw new Error("请先在 Photoshop 中选择一个区域。");
  }

  const bounds = toIntBounds(selectionBounds);
  return {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

function rgbaToRgbOverWhite(rgba) {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4, targetIndex += 3) {
    const alpha = rgba[sourceIndex + 3] / 255;
    rgb[targetIndex + 0] = Math.round(rgba[sourceIndex + 0] * alpha + 255 * (1 - alpha));
    rgb[targetIndex + 1] = Math.round(rgba[sourceIndex + 1] * alpha + 255 * (1 - alpha));
    rgb[targetIndex + 2] = Math.round(rgba[sourceIndex + 2] * alpha + 255 * (1 - alpha));
  }
  return rgb;
}

async function encodeImageDataBase64({ imaging, imageData, format }) {
  const normalizeBase64 = (value) => {
    if (typeof value !== "string") {
      throw new Error(`encodeImageData 返回了 ${typeof value}，而不是字符串。`);
    }

    let normalized = value.trim();
    if (normalized.startsWith("data:")) {
      const commaIndex = normalized.indexOf(",");
      if (commaIndex < 0) {
        throw new Error("encodeImageData 返回了无效的 Data URL。");
      }
      normalized = normalized.slice(commaIndex + 1);
    }

    normalized = normalized.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const mod = normalized.length % 4;
    if (mod) {
      normalized += "=".repeat(4 - mod);
    }

    if (!/^[A-Za-z0-9+/]+=*$/.test(normalized)) {
      throw new Error("encodeImageData 返回了无效的 Base64 数据。");
    }

    return normalized;
  };

  const attemptCalls = [
    async () => imaging.encodeImageData({ imageData, format, base64: true }),
    async () => imaging.encodeImageData(imageData, { format, base64: true }),
    async () => imaging.encodeImageData({ imageData, format }),
  ];

  let lastError = null;
  for (const attempt of attemptCalls) {
    try {
      const encoded = await attempt();
      const value = typeof encoded === "string" ? encoded : encoded?.data;
      if (!value) {
        throw new Error("encodeImageData 返回了空结果。");
      }
      return normalizeBase64(value);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("encodeImageData 执行失败。");
}

export async function selectionToImageBase64Host() {
  const photoshop = require("photoshop");
  const { app, core, imaging } = photoshop;

  if (!imaging) {
    throw new Error("当前 Photoshop 版本不支持 imaging API。");
  }

  const documentRef = app.activeDocument;
  if (!documentRef) {
    throw new Error("请先打开一个 Photoshop 文档。");
  }

  const captured = await core.executeAsModal(
    async () => {
      const activeDocument = app.activeDocument;
      const selectionBounds = activeDocument?.selection?.bounds;
      if (!selectionBounds) {
        throw new Error("请先在 Photoshop 中选择一个区域。");
      }

      const bounds = toIntBounds(selectionBounds);
      const pixelObject = await imaging.getPixels({
        documentID: activeDocument.id,
        sourceBounds: {
          left: bounds.left,
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
        },
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1",
        componentSize: 8,
      });

      let maskObject = null;
      try {
        maskObject = await imaging.getSelection({
          documentID: activeDocument.id,
          sourceBounds: {
            left: bounds.left,
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom,
          },
        });
      } catch {
        maskObject = null;
      }

      const pixelData = await pixelObject.imageData.getData({ chunky: true });
      const pixelComponents = pixelObject.imageData.components;
      const maskData = maskObject ? await maskObject.imageData.getData({ chunky: true }) : null;

      const rgba = new Uint8ClampedArray(bounds.width * bounds.height * 4);
      for (let index = 0; index < bounds.width * bounds.height; index += 1) {
        const maskValue = maskData ? maskData[index] ?? 0 : 255;
        if (pixelComponents === 4) {
          rgba[index * 4 + 0] = pixelData[index * 4 + 0];
          rgba[index * 4 + 1] = pixelData[index * 4 + 1];
          rgba[index * 4 + 2] = pixelData[index * 4 + 2];
          rgba[index * 4 + 3] = Math.round((pixelData[index * 4 + 3] * maskValue) / 255);
        } else {
          rgba[index * 4 + 0] = pixelData[index * 3 + 0];
          rgba[index * 4 + 1] = pixelData[index * 3 + 1];
          rgba[index * 4 + 2] = pixelData[index * 3 + 2];
          rgba[index * 4 + 3] = maskValue;
        }
      }

      pixelObject.imageData.dispose();
      if (maskObject) {
        maskObject.imageData.dispose();
      }

      return {
        docId: activeDocument.id,
        bounds: {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
        rgbaBuffer: rgba.buffer,
      };
    },
    { commandName: "读取选区" }
  );

  const encoded = await core.executeAsModal(
    async () => {
      if (typeof imaging.encodeImageData !== "function") {
        throw new Error("当前 Photoshop 版本不支持 imaging.encodeImageData。");
      }

      const rgba = new Uint8Array(captured.rgbaBuffer);

      let imageData = await imaging.createImageDataFromBuffer(rgba, {
        width: captured.bounds.width,
        height: captured.bounds.height,
        components: 4,
        chunky: true,
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1",
      });

      try {
        const base64 = await encodeImageDataBase64({
          imaging,
          imageData,
          format: "png",
        });
        return { mime: "image/png", base64 };
      } catch (error) {
        const message = error?.message || String(error);
        if (!/alpha|jpeg|jpg/i.test(message)) {
          throw error;
        }
      } finally {
        imageData.dispose();
      }

      const rgb = rgbaToRgbOverWhite(rgba);
      imageData = await imaging.createImageDataFromBuffer(rgb, {
        width: captured.bounds.width,
        height: captured.bounds.height,
        components: 3,
        chunky: true,
        colorSpace: "RGB",
        colorProfile: "sRGB IEC61966-2.1",
      });

      try {
        const base64 = await encodeImageDataBase64({
          imaging,
          imageData,
          format: "jpeg",
        });
        return { mime: "image/jpeg", base64 };
      } finally {
        imageData.dispose();
      }
    },
    { commandName: "编码选区" }
  );

  return {
    docId: captured.docId,
    bounds: captured.bounds,
    mime: encoded.mime,
    base64: encoded.base64,
  };
}

function unitToNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value.as === "function") {
    try {
      const pixels = value.as("px");
      if (Number.isFinite(pixels)) {
        return pixels;
      }
    } catch {
      // Ignore conversion errors and continue with the remaining fallbacks.
    }
  }
  if (value && typeof value.value === "number") {
    return value.value;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

async function maybeAwait(value) {
  if (value && typeof value.then === "function") {
    await value;
  }
}

function normalizeTargetBounds(bounds) {
  const left = unitToNumber(bounds?.left);
  const top = unitToNumber(bounds?.top);
  const width = unitToNumber(bounds?.width);
  const height = unitToNumber(bounds?.height);

  if (![left, top, width, height].every(Number.isFinite)) {
    throw new Error("目标区域无效。");
  }
  if (width <= 0 || height <= 0) {
    throw new Error("目标区域尺寸必须大于 0。");
  }

  return { left, top, width, height };
}

function getLayerBoundsPx(layer) {
  const bounds = layer?.boundsNoEffects || layer?.bounds;
  if (!bounds) {
    throw new Error("放置后的图层没有可读取的边界。");
  }

  const left = unitToNumber(bounds.left);
  const top = unitToNumber(bounds.top);
  const right = unitToNumber(bounds.right);
  const bottom = unitToNumber(bounds.bottom);
  if (![left, top, right, bottom].every(Number.isFinite)) {
    throw new Error("放置后的图层边界无效。");
  }

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

async function getActiveLayerId({ action }) {
  const response = await action.batchPlay(
    [
      {
        _obj: "get",
        _target: {
          _ref: [
            { _property: "layerID" },
            { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
            { _ref: "document", _enum: "ordinal", _value: "targetEnum" },
          ],
        },
      },
    ],
    { synchronousExecution: true, modalBehavior: "execute" }
  );
  const layerId = response?.[0]?.layerID;
  if (typeof layerId !== "number") {
    throw new Error("无法解析放置后图层的 ID。");
  }
  return layerId;
}

async function transformLayer({ action, layerId, scaleX, scaleY, dx, dy }) {
  const commands = [];

  if (Number.isFinite(scaleX) && Number.isFinite(scaleY) && (scaleX !== 100 || scaleY !== 100)) {
    commands.push({
      _obj: "transform",
      _target: [{ _ref: "layer", _id: layerId }],
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      width: { _unit: "percentUnit", _value: scaleX },
      height: { _unit: "percentUnit", _value: scaleY },
      linked: false,
      _options: { dialogOptions: "silent" },
    });
  }

  if (Number.isFinite(dx) && Number.isFinite(dy) && (dx !== 0 || dy !== 0)) {
    commands.push({
      _obj: "transform",
      _target: [{ _ref: "layer", _id: layerId }],
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: {
        _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: dx },
        vertical: { _unit: "pixelsUnit", _value: dy },
      },
      _options: { dialogOptions: "silent" },
    });
  }

  if (!commands.length) {
    return;
  }

  await action.batchPlay(commands, {
    synchronousExecution: true,
    modalBehavior: "execute",
  });
}

export async function placeImageUrlAtBoundsHost(imageUrl, bounds) {
  const photoshop = require("photoshop");
  const { app, action, core } = photoshop;
  const uxp = require("uxp");
  const fs = uxp.storage.localFileSystem;
  const formats = uxp.storage.formats;

  const documentRef = app.activeDocument;
  if (!documentRef) {
    throw new Error("请先打开一个 Photoshop 文档。");
  }

  const buffer = await fetchArrayBuffer(imageUrl);
  const tmpFolder = await fs.getTemporaryFolder();
  const file = await tmpFolder.createFile(`aya-result-${Date.now()}.png`, {
    overwrite: true,
  });
  await file.write(buffer, { format: formats.binary });

  const targetBounds = normalizeTargetBounds(bounds);

  await core.executeAsModal(
    async () => {
      const token = fs.createSessionToken(file);

      await action.batchPlay(
        [
          {
            _obj: "placeEvent",
            null: {
              _path: token,
              _kind: "local",
            },
            freeTransformCenterState: {
              _enum: "quadCenterState",
              _value: "QCSAverage",
            },
          },
        ],
        { synchronousExecution: true, modalBehavior: "execute" }
      );

      const placedLayer = documentRef.activeLayers?.[0];
      if (!placedLayer) {
        throw new Error("Photoshop 未创建放置图层。");
      }

      const layerBounds = getLayerBoundsPx(placedLayer);
      const currentWidth = Math.max(1, layerBounds.width);
      const currentHeight = Math.max(1, layerBounds.height);
      const scaleUniform = Math.max(
        targetBounds.width / currentWidth,
        targetBounds.height / currentHeight
      ) * 100;

      if (!Number.isFinite(scaleUniform)) {
        throw new Error("无法缩放放置后的图片。");
      }

      const anchor = photoshop.constants?.AnchorPosition?.TOPLEFT;
      const canResizeWithDom = typeof placedLayer.resize === "function";
      const canTranslateWithDom = typeof placedLayer.translate === "function";

      if (canResizeWithDom && canTranslateWithDom) {
        await maybeAwait(placedLayer.resize(scaleUniform, scaleUniform, anchor));

        const resizedBounds = getLayerBoundsPx(placedLayer);
        const desiredLeft = targetBounds.left + (targetBounds.width - resizedBounds.width) / 2;
        const desiredTop = targetBounds.top + (targetBounds.height - resizedBounds.height) / 2;
        await maybeAwait(
          placedLayer.translate(
            desiredLeft - resizedBounds.left,
            desiredTop - resizedBounds.top
          )
        );
        return;
      }

      const layerId = await getActiveLayerId({ action });
      await transformLayer({
        action,
        layerId,
        scaleX: scaleUniform,
        scaleY: scaleUniform,
        dx: 0,
        dy: 0,
      });

      const resizedBounds = getLayerBoundsPx(placedLayer);
      const desiredLeft = targetBounds.left + (targetBounds.width - resizedBounds.width) / 2;
      const desiredTop = targetBounds.top + (targetBounds.height - resizedBounds.height) / 2;
      await transformLayer({
        action,
        layerId,
        scaleX: 100,
        scaleY: 100,
        dx: desiredLeft - resizedBounds.left,
        dy: desiredTop - resizedBounds.top,
      });
    },
    { commandName: "放置 AI 结果" }
  );
}
