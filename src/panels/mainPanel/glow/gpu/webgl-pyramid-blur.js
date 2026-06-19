/**
 * WebGL2 金字塔模糊 Shader
 * 使用 GPU 实现 Kawase 模糊的拉普拉斯金字塔
 */

import {
  createProgram,
  createTexture,
  createFramebuffer,
  readPixelsToImageData,
  FULLSCREEN_VERTEX,
} from "./webgl-helpers.js";

// Kawase 模糊 Fragment Shader
const KAWASE_BLUR_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform float uOffset;

out vec4 fragColor;

void main() {
  vec2 off = uTexelSize * uOffset;
  // 5点采样: 四角 + 中心(权重2)
  vec4 s1 = texture(uInput, vUv + vec2(-off.x, -off.y));
  vec4 s2 = texture(uInput, vUv + vec2( off.x, -off.y));
  vec4 s3 = texture(uInput, vUv + vec2(-off.x,  off.y));
  vec4 s4 = texture(uInput, vUv + vec2( off.x,  off.y));
  vec4 s5 = texture(uInput, vUv) * 2.0;
  fragColor = (s1 + s2 + s3 + s4 + s5) / 6.0;
}`;

// 加权混合 Fragment Shader
const ADD_WEIGHTED_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uLayerA;
uniform sampler2D uLayerB;
uniform float uWeightB;

out vec4 fragColor;

void main() {
  vec4 a = texture(uLayerA, vUv);
  vec4 b = texture(uLayerB, vUv);
  fragColor = a * (1.0 - uWeightB) + b * uWeightB;
}`;

/**
 * WebGL2 金字塔模糊器
 */
export class WebglPyramidBlurBackend {
  constructor() {
    this._blurProgram = null;
    this._blendProgram = null;
  }

  init(gl, quadVao) {
    this._gl = gl;
    this._quadVao = quadVao;
    this._blurProgram = createProgram(gl, FULLSCREEN_VERTEX, KAWASE_BLUR_FRAGMENT);
    this._blendProgram = createProgram(gl, FULLSCREEN_VERTEX, ADD_WEIGHTED_FRAGMENT);
  }

  buildMultiScaleGlow(sourceLayer, params) {
    const gl = this._gl;
    const { blur } = params;
    const levels = 3;
    const mipWeights = blur.mipWeights;

    // 构建金字塔
    const pyramid = [sourceLayer];
    let current = sourceLayer;
    for (let i = 1; i < levels; i++) {
      const downsampled = this._downsample(current, 2);
      const blurred = this._kawaseBlur(downsampled, Math.max(1, Math.round(blur.radius * (i + 1) * 0.5)));
      pyramid.push(blurred);
      current = blurred;
    }

    // 自底向上合并
    let combined = pyramid[levels - 1];
    for (let i = levels - 2; i >= 0; i--) {
      const upsampled = this._upsample(combined, pyramid[i].width, pyramid[i].height);
      const weight = mipWeights[i] || 0.5;
      const merged = this._addWeighted(upsampled, pyramid[i], weight);
      combined = this._kawaseBlur(merged, Math.max(1, Math.round(blur.radius * 0.3)));
    }

    return { glowLayer: combined };
  }

  _kawaseBlur(layer, offset = 1) {
    const gl = this._gl;
    const { width, height } = layer;

    const inputTex = createTexture(gl, width, height, layer.data);
    const outTex = createTexture(gl, width, height);
    const fb = createFramebuffer(gl, [outTex]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this._blurProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inputTex);
    gl.uniform1i(gl.getUniformLocation(this._blurProgram, "uInput"), 0);
    gl.uniform2f(gl.getUniformLocation(this._blurProgram, "uTexelSize"), 1 / width, 1 / height);
    gl.uniform1f(gl.getUniformLocation(this._blurProgram, "uOffset"), offset);

    gl.bindVertexArray(this._quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const result = readPixelsToImageData(gl, width, height);

    gl.deleteTexture(inputTex);
    gl.deleteTexture(outTex);
    gl.deleteFramebuffer(fb);

    return result;
  }

  _addWeighted(layerA, layerB, weightB) {
    const gl = this._gl;
    const { width, height } = layerB;

    const texA = createTexture(gl, layerA.width, layerA.height, layerA.data);
    const texB = createTexture(gl, width, height, layerB.data);
    const outTex = createTexture(gl, width, height);
    const fb = createFramebuffer(gl, [outTex]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this._blendProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(gl.getUniformLocation(this._blendProgram, "uLayerA"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.uniform1i(gl.getUniformLocation(this._blendProgram, "uLayerB"), 1);
    gl.uniform1f(gl.getUniformLocation(this._blendProgram, "uWeightB"), weightB);

    gl.bindVertexArray(this._quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const result = readPixelsToImageData(gl, width, height);

    gl.deleteTexture(texA);
    gl.deleteTexture(texB);
    gl.deleteTexture(outTex);
    gl.deleteFramebuffer(fb);

    return result;
  }

  _downsample(layer, factor) {
    const { width, height, data } = layer;
    const newW = Math.max(1, Math.floor(width / factor));
    const newH = Math.max(1, Math.floor(height / factor));
    const out = new Uint8ClampedArray(newW * newH * 4);

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        const srcX = x * factor;
        const srcY = y * factor;
        const outIdx = (y * newW + x) * 4;
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let dy = 0; dy < factor && srcY + dy < height; dy++) {
          for (let dx = 0; dx < factor && srcX + dx < width; dx++) {
            const srcIdx = ((srcY + dy) * width + (srcX + dx)) * 4;
            r += data[srcIdx]; g += data[srcIdx + 1];
            b += data[srcIdx + 2]; a += data[srcIdx + 3];
            count++;
          }
        }
        out[outIdx] = r / count; out[outIdx + 1] = g / count;
        out[outIdx + 2] = b / count; out[outIdx + 3] = a / count;
      }
    }
    return new ImageData(out, newW, newH);
  }

  _upsample(layer, targetWidth, targetHeight) {
    const { width, height, data } = layer;
    const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
    const scaleX = width / targetWidth;
    const scaleY = height / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const x0 = Math.floor(srcX), y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
        const fx = srcX - x0, fy = srcY - y0;
        const outIdx = (y * targetWidth + x) * 4;
        const i00 = (y0 * width + x0) * 4, i10 = (y0 * width + x1) * 4;
        const i01 = (y1 * width + x0) * 4, i11 = (y1 * width + x1) * 4;
        for (let c = 0; c < 4; c++) {
          out[outIdx + c] =
            data[i00 + c] * (1 - fx) * (1 - fy) + data[i10 + c] * fx * (1 - fy) +
            data[i01 + c] * (1 - fx) * fy + data[i11 + c] * fx * fy;
        }
      }
    }
    return new ImageData(out, targetWidth, targetHeight);
  }

  cleanup() {
    const gl = this._gl;
    if (this._blurProgram) gl.deleteProgram(this._blurProgram);
    if (this._blendProgram) gl.deleteProgram(this._blendProgram);
  }
}
