/**
 * 辉光效果引擎 - 双后端自动切换
 * 提供统一的 API，自动选择 CPU 或 WebGL2 后端
 */

import { normalizeGlowParams } from "./presets.js";
import { buildSourceMask } from "./source-mask.js";
import { buildMultiScaleGlow } from "./pyramid-blur.js";
import { composite, renderGlowLayer } from "./compositor.js";
import { canUseWebgl2 } from "./gpu/capabilities.js";
import { createGlowContext } from "./gpu/webgl-helpers.js";
import { WebglSourceMaskBackend } from "./gpu/webgl-source-mask.js";
import { WebglPyramidBlurBackend } from "./gpu/webgl-pyramid-blur.js";
import { WebglCompositorBackend } from "./gpu/webgl-compositor.js";

/**
 * Linear Dodge (加法) 合成: base + glow * alpha
 * Linear Dodge (加法) 合成
 * 这是用户最终看到的预览效果
 */
function buildLinearDodgePreview(baseImageData, glowLayerImageData) {
  const { width, height } = baseImageData;
  const base = baseImageData.data;
  const glow = glowLayerImageData.data;
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const alpha = (glow[i + 3] || 0) / 255;
    out[i] = Math.min(255, Math.round(base[i] + glow[i] * alpha));
    out[i + 1] = Math.min(255, Math.round(base[i + 1] + glow[i + 1] * alpha));
    out[i + 2] = Math.min(255, Math.round(base[i + 2] + glow[i + 2] * alpha));
    out[i + 3] = base[i + 3];
  }
  return new ImageData(out, width, height);
}

/**
 * 将 Float32 层量化为 RGBA8 再转回 Float32
 * Float32 → Uint8 → Float32 量化
 * Uint8 量化自然截断 < 0.002 的微小值，消除暗部辉光残留
 */
function quantizeLayerToRgba8(layer) {
  const count = layer.width * layer.height;
  const outR = new Float32Array(count);
  const outG = new Float32Array(count);
  const outB = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    outR[i] = Math.round(Math.min(1, Math.max(0, layer.r[i])) * 255) / 255;
    outG[i] = Math.round(Math.min(1, Math.max(0, layer.g[i])) * 255) / 255;
    outB[i] = Math.round(Math.min(1, Math.max(0, layer.b[i])) * 255) / 255;
  }
  return { width: layer.width, height: layer.height, r: outR, g: outG, b: outB };
}

// 预览尺寸常量
export const GLOW_INTERACTIVE_DIMENSION = 1100;
export const GLOW_DRAG_DIMENSION = 900;
export const GLOW_FULL_DIMENSION = Infinity; // 全分辨率

/**
 * 辉光引擎
 */
export class GlowEngine {
  constructor() {
    this._backend = null; // "cpu" | "webgl2"
    this._gpuContext = null;
    this._sourceMaskBackend = null;
    this._pyramidBlurBackend = null;
    this._compositorBackend = null;
    this._initialized = false;
  }

  /**
   * 初始化引擎 (延迟初始化 GPU 资源)
   */
  _initGpu(canvas) {
    if (this._initialized) return;

    const ctx = createGlowContext(canvas);
    if (ctx) {
      this._gpuContext = ctx;
      this._sourceMaskBackend = new WebglSourceMaskBackend();
      this._pyramidBlurBackend = new WebglPyramidBlurBackend();
      this._compositorBackend = new WebglCompositorBackend();

      this._sourceMaskBackend.init(ctx.gl, ctx.quadVao);
      this._pyramidBlurBackend.init(ctx.gl, ctx.quadVao);
      this._compositorBackend.init(ctx.gl, ctx.quadVao);

      this._backend = "webgl2";
    } else {
      this._backend = "cpu";
    }

    this._initialized = true;
  }

  /**
   * 处理辉光效果
   * @param {ImageData} imageData - 输入图像
   * @param {Object} config - 用户参数
   * @param {HTMLCanvasElement} [canvas] - GPU 渲染目标 (可选)
   * @returns {ImageData}
   */
  process(imageData, config, canvas = null) {
    const params = normalizeGlowParams(config);
    const { width, height } = imageData;

    // 检测是否需要 GPU 加速
    const useGpu = canvas && canUseWebgl2(width, height);

    if (useGpu) {
      this._initGpu(canvas);
    }

    if (this._backend === "webgl2" && useGpu) {
      return this._processGpu(imageData, params);
    } else {
      return this._processCpu(imageData, params);
    }
  }

  /**
   * CPU 后端处理
   */
  _processCpu(imageData, params) {
    // 1. 源遮罩 (Float32)
    const { sourceLayer, masks } = buildSourceMask(imageData, params);

    // 1.5 量化: Float32 → Uint8 → Float32
    // 与 GPU 流水线一致: sourceLayerToRgba8() → createTexture()
    // Uint8 量化自然截断 < 0.002 的微小值，消除暗部辉光残留
    const quantizedSource = quantizeLayerToRgba8(sourceLayer);

    // 2. 多尺度模糊 (Float32，但经过量化)
    const { glowLayer } = buildMultiScaleGlow(quantizedSource, params);

    // 3. 渲染辉光层 (独立的辉光，不含 base 混合)
    const glowLayerImageData = renderGlowLayer(glowLayer, masks, params);

    // 4. Linear Dodge 合成: base + glow * alpha (与原版 buildLinearDodgePreview 一致)
    return buildLinearDodgePreview(imageData, glowLayerImageData);
  }

  /**
   * WebGL2 后端处理
   */
  _processGpu(imageData, params) {
    // 1. 源遮罩 (GPU)
    const { sourceLayer, masks } = this._sourceMaskBackend.buildSourceMask(imageData, params);

    // 2. 多尺度模糊 (GPU)
    const { glowLayer } = this._pyramidBlurBackend.buildMultiScaleGlow(sourceLayer, params);

    // 3. 合成 (GPU)
    return this._compositorBackend.composite(imageData, glowLayer, masks, params);
  }

  /**
   * 降采样图像
   */
  static downsampleImage(imageData, maxDimension) {
    const { width, height } = imageData;
    if (width <= maxDimension && height <= maxDimension) return imageData;

    const scale = maxDimension / Math.max(width, height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = newW;
    outCanvas.height = newH;
    const outCtx = outCanvas.getContext("2d");
    outCtx.drawImage(canvas, 0, 0, newW, newH);

    return outCtx.getImageData(0, 0, newW, newH);
  }

  /**
   * ImageData 转 DataURL
   */
  static imageDataToDataUrl(imageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /**
   * DataURL 转 ImageData
   */
  static async dataUrlToImageData(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * 释放资源
   */
  cleanup() {
    if (this._sourceMaskBackend) this._sourceMaskBackend.cleanup();
    if (this._pyramidBlurBackend) this._pyramidBlurBackend.cleanup();
    if (this._compositorBackend) this._compositorBackend.cleanup();
    if (this._gpuContext) this._gpuContext.cleanup();
    this._initialized = false;
  }
}
