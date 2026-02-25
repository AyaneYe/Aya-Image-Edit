import { executeAsModal } from "@bubblydoo/uxp-toolkit";

import { fetchArrayBufferFromImageUrl } from "./imageBinaryService";

function unitToNumber(v) {
  if (typeof v === "number") return v;
  if (v && typeof v.as === "function") {
    try {
      const px = v.as("px");
      if (Number.isFinite(px)) return px;
    } catch {
      // ignore
    }
  }
  if (v && typeof v.value === "number") return v.value;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
    throw new Error("放置失败：目标 bounds 非数字");
  }
  if (width <= 0 || height <= 0) {
    throw new Error("放置失败：目标 bounds 宽高必须大于 0");
  }
  return { left, top, width, height };
}

function getLayerBoundsPx(layer) {
  const b = layer?.boundsNoEffects || layer?.bounds;
  if (!b) throw new Error("无法读取新图层 bounds");
  const left = unitToNumber(b.left);
  const top = unitToNumber(b.top);
  const right = unitToNumber(b.right);
  const bottom = unitToNumber(b.bottom);
  if (![left, top, right, bottom].every(Number.isFinite)) {
    throw new Error("无法读取新图层 bounds（数值无效）");
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

async function getActiveLayerId({ action }) {
  const res = await action.batchPlay(
    [
      {
        _obj: "get",
        _target: {
          _ref: [
            { _property: "layerID" },
            { _ref: "layer", _enum: "ordinal", _value: "targetEnum" },
            { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
          ]
        }
      }
    ],
    { synchronousExecution: true, modalBehavior: "execute" }
  );
  const id = res?.[0]?.layerID;
  if (typeof id !== "number") throw new Error("放置失败：无法获取新图层 ID");
  return id;
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
      _options: { dialogOptions: "silent" }
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
        vertical: { _unit: "pixelsUnit", _value: dy }
      },
      _options: { dialogOptions: "silent" }
    });
  }

  if (!commands.length) return;
  await action.batchPlay(commands, { synchronousExecution: true, modalBehavior: "execute" });
}

export async function placeImageUrlAtBounds(imageUrl, bounds) {
  const photoshop = require("photoshop");
  const { app, action } = photoshop;
  const uxp = require("uxp");
  const fs = uxp.storage.localFileSystem;
  const formats = uxp.storage.formats;

  const doc = app.activeDocument;
  if (!doc) throw new Error("未找到活动文档");

  const buf = await fetchArrayBufferFromImageUrl(imageUrl);

  const tmpFolder = await fs.getTemporaryFolder();
  const file = await tmpFolder.createFile(`aya-result-${Date.now()}.png`, { overwrite: true });
  await file.write(buf, { format: formats.binary });

  const target = normalizeTargetBounds(bounds);

  await executeAsModal("Place AI Image", async () => {
      const token = fs.createSessionToken(file);

      await action.batchPlay(
        [
          {
            _obj: "placeEvent",
            null: {
              _path: token,
              _kind: "local"
            },
            freeTransformCenterState: {
              _enum: "quadCenterState",
              _value: "QCSAverage"
            }
          }
        ],
        { synchronousExecution: true, modalBehavior: "execute" }
      );

      const placedLayer = doc.activeLayers?.[0];
      if (!placedLayer) throw new Error("放置图片失败：未找到新图层");

      const lb = getLayerBoundsPx(placedLayer);
      const currentW = Math.max(1, lb.width);
      const currentH = Math.max(1, lb.height);

      // Keep aspect ratio: scale uniformly to fill the target bounds (cover)
      const scaleUniform = Math.max(target.width / currentW, target.height / currentH) * 100;
      if (![scaleUniform].every(Number.isFinite)) {
        throw new Error("放置失败：计算缩放比例失败");
      }

      const constants = photoshop.constants;
      const anchor = constants?.AnchorPosition?.TOPLEFT;
      const canDomResize = typeof placedLayer.resize === "function";
      const canDomTranslate = typeof placedLayer.translate === "function";

      if (canDomResize && canDomTranslate) {
        await maybeAwait(placedLayer.resize(scaleUniform, scaleUniform, anchor));

        const lb2 = getLayerBoundsPx(placedLayer);
        const desiredLeft = target.left + (target.width - lb2.width) / 2;
        const desiredTop = target.top + (target.height - lb2.height) / 2;
        const dx = desiredLeft - lb2.left;
        const dy = desiredTop - lb2.top;
        await maybeAwait(placedLayer.translate(dx, dy));
        return;
      }

      const layerId = await getActiveLayerId({ action });
      await transformLayer({ action, layerId, scaleX: scaleUniform, scaleY: scaleUniform, dx: 0, dy: 0 });

      const lb2 = getLayerBoundsPx(placedLayer);
      const desiredLeft = target.left + (target.width - lb2.width) / 2;
      const desiredTop = target.top + (target.height - lb2.height) / 2;
      const dx = desiredLeft - lb2.left;
      const dy = desiredTop - lb2.top;
      await transformLayer({ action, layerId, scaleX: 100, scaleY: 100, dx, dy });
    });
}
