/**
 * WebGL2 源遮罩生成 Shader
 * 使用 GPU 并行计算亮度、饱和度、对比度等特征并生成辉光源遮罩
 */

import {
  createGlowContext,
  createProgram,
  createTexture,
  createFramebuffer,
  readPixelsToImageData,
  FULLSCREEN_VERTEX,
} from "./webgl-helpers.js";

// 源遮罩 Fragment Shader
const SOURCE_MASK_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uImage;
uniform float uThreshold;
uniform float uKnee;
uniform float uBrightnessBias;
uniform float uSaturationGain;

layout(location = 0) out vec4 outSource;
layout(location = 1) out vec4 outMasks;

float softThresholdMask(float value, float threshold, float knee) {
  float soft = clamp(value - threshold + knee, 0.0, knee * 2.0);
  float curved = (soft * soft) / (knee * 4.0);
  return clamp(max(curved, value - threshold) / max(value, 1e-4), 0.0, 1.0);
}

float smoothstepCustom(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float computeHue(float r, float g, float b, float maxC, float minC) {
  if (maxC == minC) return 0.0;
  float d = maxC - minC;
  float h;
  if (maxC == r) h = ((g - b) / d + (g < b ? 6.0 : 0.0)) * 60.0;
  else if (maxC == g) h = ((b - r) / d + 2.0) * 60.0;
  else h = ((r - g) / d + 4.0) * 60.0;
  return h;
}

void main() {
  vec4 pixel = texture(uImage, vUv);
  float r = pixel.r;
  float g = pixel.g;
  float b = pixel.b;

  // 亮度 (Rec. 709)
  float luma = r * 0.2126 + g * 0.7152 + b * 0.0722;

  // 最大/最小通道
  float maxC = max(r, max(g, b));
  float minC = min(r, min(g, b));

  // 饱和度
  float sat = maxC > 0.0 ? (maxC - minC) / maxC : 0.0;

  // 色相
  float hue = computeHue(r, g, b, maxC, minC);

  // 亮度分数
  float adjustedLuma = luma + uBrightnessBias;
  float lumaScore = softThresholdMask(adjustedLuma, uThreshold, uKnee);

  // 对比度分数
  float contrast = maxC - minC;
  float contrastScore = smoothstepCustom(0.05, 0.4, contrast);

  // 高光分数
  float specularScore = smoothstepCustom(0.7, 0.95, maxC);

  // 白色平坦区域
  float whiteFlat = smoothstepCustom(0.75, 0.95, luma) *
    (1.0 - smoothstepCustom(0.02, 0.15, contrast)) *
    (1.0 - smoothstepCustom(0.05, 0.2, sat));

  // 肤色检测
  float skinHue = smoothstepCustom(3.0, 10.0, hue) * (1.0 - smoothstepCustom(48.0, 58.0, hue));
  float skinSat = smoothstepCustom(0.08, 0.25, sat) * (1.0 - smoothstepCustom(0.55, 0.75, sat));
  float skinColor = skinHue * skinSat;

  // 暗部保护
  float darkProtect = 1.0 - smoothstepCustom(0.02, 0.15, adjustedLuma);

  // 接近裁剪
  float nearClip = smoothstepCustom(0.88, 0.96, maxC);

  // 组合遮罩
  float combinedSource = lumaScore * (0.6 + contrastScore * 0.2 + specularScore * 0.2);
  float reflectiveBoost = 1.0 + nearClip * 0.3;
  float protection = whiteFlat * 0.65 + skinColor * 0.45 + darkProtect * 0.7;
  float mask = combinedSource * reflectiveBoost * (1.0 - protection * 0.82);
  mask = clamp(mask, 0.0, 1.0);

  // 源颜色
  float colorGain = uSaturationGain;
  vec3 sourceColor = vec3(luma) + (pixel.rgb - vec3(luma)) * colorGain;

  // 输出源遮罩 (MRT 0)
  outSource = vec4(sourceColor * mask, pixel.a * mask);
  // 输出遮罩数据 (MRT 1) - R: mask, G: luma, B: protection, A: sat
  outMasks = vec4(mask, luma, protection, sat);
}`;

/**
 * WebGL2 源遮罩生成器
 */
export class WebglSourceMaskBackend {
  constructor() {
    this._context = null;
    this._program = null;
    this._inputTex = null;
    this._sourceTex = null;
    this._masksTex = null;
    this._fb = null;
  }

  init(gl, quadVao) {
    this._gl = gl;
    this._quadVao = quadVao;
    this._program = createProgram(gl, FULLSCREEN_VERTEX, SOURCE_MASK_FRAGMENT);
    this._program._uniforms = {};
  }

  buildSourceMask(imageData, params) {
    const gl = this._gl;
    const { width, height } = imageData;
    const { source } = params;

    // 创建/更新输入纹理
    if (this._inputTex) gl.deleteTexture(this._inputTex);
    this._inputTex = createTexture(gl, width, height, imageData.data);

    // 创建输出纹理
    if (this._sourceTex) gl.deleteTexture(this._sourceTex);
    if (this._masksTex) gl.deleteTexture(this._masksTex);
    this._sourceTex = createTexture(gl, width, height);
    this._masksTex = createTexture(gl, width, height);

    // 创建帧缓冲
    if (this._fb) gl.deleteFramebuffer(this._fb);
    this._fb = createFramebuffer(gl, [this._sourceTex, this._masksTex]);

    // 渲染
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fb);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this._program);

    // 设置 uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._inputTex);
    gl.uniform1i(gl.getUniformLocation(this._program, "uImage"), 0);
    gl.uniform1f(gl.getUniformLocation(this._program, "uThreshold"), source.threshold);
    gl.uniform1f(gl.getUniformLocation(this._program, "uKnee"), source.knee);
    gl.uniform1f(gl.getUniformLocation(this._program, "uBrightnessBias"), source.brightnessBias);
    gl.uniform1f(gl.getUniformLocation(this._program, "uSaturationGain"), source.saturationGain);

    // 绘制全屏四边形
    gl.bindVertexArray(this._quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 读取结果
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    const sourceLayer = readPixelsToImageData(gl, width, height);
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    const masksData = readPixelsToImageData(gl, width, height);

    // 提取 maskData
    const maskData = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      maskData[i] = masksData.data[i * 4] / 255; // R channel = mask
    }

    return {
      sourceLayer,
      masks: { maskData, width, height },
    };
  }

  cleanup() {
    const gl = this._gl;
    if (this._inputTex) gl.deleteTexture(this._inputTex);
    if (this._sourceTex) gl.deleteTexture(this._sourceTex);
    if (this._masksTex) gl.deleteTexture(this._masksTex);
    if (this._fb) gl.deleteFramebuffer(this._fb);
    if (this._program) gl.deleteProgram(this._program);
  }
}
