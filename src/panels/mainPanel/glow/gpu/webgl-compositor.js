/**
 * WebGL2 合成器 Shader
 * GPU 加速的辉光合成（Screen/Soft Light 混合、Core/Halo 分离、色散）
 */

import {
  createProgram,
  createTexture,
  createFramebuffer,
  readPixelsToImageData,
  FULLSCREEN_VERTEX,
} from "./webgl-helpers.js";

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uGlow;
uniform sampler2D uMasks;
uniform float uSoftAddMix;
uniform float uCoreSuppression;
uniform float uHaloMix;
uniform float uWarmth;
uniform float uShoulder;
uniform float uDarkLift;
uniform float uChromatic;
uniform float uColorAmount;
uniform vec3 uColorRgb;
uniform int uColorEnabled;
uniform int uChromaticEnabled;

out vec4 fragColor;

float smoothstepCustom(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float softShoulder(float value, float shoulder) {
  return value / (1.0 + value * shoulder);
}

float getProtection(float luma, float contrast, float sat) {
  float whiteFlat = smoothstepCustom(0.75, 0.95, luma) *
    (1.0 - smoothstepCustom(0.02, 0.15, contrast)) *
    (1.0 - smoothstepCustom(0.05, 0.2, sat));
  float darkProtect = 1.0 - smoothstepCustom(0.02, 0.15, luma);
  return whiteFlat * 0.65 + darkProtect * 0.7;
}

void main() {
  vec4 base = texture(uBase, vUv);
  vec4 masks = texture(uMasks, vUv);
  float mask = masks.r;
  float luma = masks.g;
  float protection = masks.b;
  float sat = masks.a;

  // 读取辉光 (可能带色散)
  vec3 glow;
  if (uChromaticEnabled == 1 && uChromatic > 0.0) {
    vec2 chromaOffset = vec2(uChromatic, 0.0);
    float r = texture(uGlow, vUv + chromaOffset).r;
    float g = texture(uGlow, vUv).g;
    float b = texture(uGlow, vUv - chromaOffset).b;
    glow = vec3(r, g, b);

    // 边缘色散增强
    float edgeGate = mask * (0.68 + (1.0 - protection) * 0.32);
    float centerMax = max(max(r, g), b);
    float fringeR = max(0.0, r - centerMax * 0.62) * uChromatic * 2.18 * edgeGate;
    float fringeB = max(0.0, b - centerMax * 0.62) * uChromatic * 2.18 * edgeGate;
    glow.r += fringeR;
    glow.b += fringeB;
  } else {
    glow = texture(uGlow, vUv).rgb;
  }

  // 暖度调整
  if (uWarmth > 0.0) {
    glow.r += uWarmth * 0.6;
    glow.g += uWarmth * 0.2;
  }

  // 高光着色
  if (uColorEnabled == 1 && uColorAmount > 0.0) {
    glow = mix(glow, uColorRgb, uColorAmount * 0.3);
  }

  // Core/Halo 分离
  float brightCoreGate = 1.0 - luma * (0.64 + uCoreSuppression * 0.28);
  float protectCoreGate = 1.0 - protection * (0.46 + uCoreSuppression * 0.4);
  float coreGate = brightCoreGate * protectCoreGate;

  float energyGate = 0.5 + mask * 0.5;
  float haloGate = (1.0 - protection * 0.46) *
    (0.36 + mask * 0.42 + uDarkLift * 0.44) *
    (0.64 + energyGate * 0.88);

  vec3 core = glow * coreGate;
  vec3 halo = glow * haloGate;
  vec3 processedGlow = core * (1.0 - uHaloMix) + halo * uHaloMix;

  // Screen 混合
  vec3 screen = 1.0 - (1.0 - base.rgb) * (1.0 - processedGlow);

  // Soft Light 混合
  float protectFactor = 1.0 - protection * (0.58 + 0.34 * protection);
  vec3 soft = base.rgb + processedGlow * (1.0 - base.rgb * protectFactor);

  // 混合
  vec3 result = screen * (1.0 - uSoftAddMix) + soft * uSoftAddMix;

  // Soft Shoulder
  result.r = softShoulder(result.r, uShoulder);
  result.g = softShoulder(result.g, uShoulder);
  result.b = softShoulder(result.b, uShoulder);

  // 饱和度保持
  float colorProtect = 1.0 - protection * 0.15;
  result *= colorProtect;

  fragColor = vec4(clamp(result, 0.0, 1.0), base.a);
}`;

/**
 * WebGL2 合成器
 */
export class WebglCompositorBackend {
  constructor() {
    this._program = null;
  }

  init(gl, quadVao) {
    this._gl = gl;
    this._quadVao = quadVao;
    this._program = createProgram(gl, FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
  }

  composite(baseImage, glowLayer, masks, params) {
    const gl = this._gl;
    const { width, height } = baseImage;
    const { composite, sourceTone } = params;

    // 创建纹理
    const baseTex = createTexture(gl, width, height, baseImage.data);
    const glowTex = createTexture(gl, glowLayer.width, glowLayer.height, glowLayer.data);
    const masksTex = createTexture(gl, masks.width, masks.height, (() => {
      const d = new Uint8ClampedArray(masks.width * masks.height * 4);
      for (let i = 0; i < masks.maskData.length; i++) {
        const v = Math.round(masks.maskData[i] * 255);
        d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
      }
      return d;
    })());

    const outTex = createTexture(gl, width, height);
    const fb = createFramebuffer(gl, [outTex]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this._program);

    // 设置 uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.uniform1i(gl.getUniformLocation(this._program, "uBase"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glowTex);
    gl.uniform1i(gl.getUniformLocation(this._program, "uGlow"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, masksTex);
    gl.uniform1i(gl.getUniformLocation(this._program, "uMasks"), 2);

    gl.uniform1f(gl.getUniformLocation(this._program, "uSoftAddMix"), composite.softAddMix);
    gl.uniform1f(gl.getUniformLocation(this._program, "uCoreSuppression"), composite.coreSuppression);
    gl.uniform1f(gl.getUniformLocation(this._program, "uHaloMix"), composite.haloMix);
    gl.uniform1f(gl.getUniformLocation(this._program, "uWarmth"), composite.warmth);
    gl.uniform1f(gl.getUniformLocation(this._program, "uShoulder"), sourceTone.shoulder);
    gl.uniform1f(gl.getUniformLocation(this._program, "uDarkLift"), sourceTone.darkLift);
    gl.uniform1f(gl.getUniformLocation(this._program, "uChromatic"), composite.chromatic);
    gl.uniform1f(gl.getUniformLocation(this._program, "uColorAmount"), composite.colorAmount);
    gl.uniform3f(gl.getUniformLocation(this._program, "uColorRgb"),
      composite.colorRgb.r, composite.colorRgb.g, composite.colorRgb.b);
    gl.uniform1i(gl.getUniformLocation(this._program, "uColorEnabled"), composite.colorEnabled ? 1 : 0);
    gl.uniform1i(gl.getUniformLocation(this._program, "uChromaticEnabled"), composite.chromaticEnabled ? 1 : 0);

    gl.bindVertexArray(this._quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const result = readPixelsToImageData(gl, width, height);

    // 清理
    gl.deleteTexture(baseTex);
    gl.deleteTexture(glowTex);
    gl.deleteTexture(masksTex);
    gl.deleteTexture(outTex);
    gl.deleteFramebuffer(fb);

    return result;
  }

  cleanup() {
    const gl = this._gl;
    if (this._program) gl.deleteProgram(this._program);
  }
}
