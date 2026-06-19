/**
 * CPU 源遮罩生成模块
 * CPU 源遮罩生成模块
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-4, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function softThresholdMask(value, threshold, knee) {
  const safeKnee = Math.max(1e-4, knee);
  const soft = clamp(value - threshold + safeKnee, 0, safeKnee * 2);
  const curved = (soft * soft) / (safeKnee * 4);
  return clamp(
    Math.max(curved, value - threshold) / Math.max(value, 1e-4),
    0,
    1
  );
}

function isSkinHueFast(r, g, b, max, min) {
  const delta = max - min;
  if (delta <= 1e-4 || max !== r) return false;
  const hue = ((g - b) / delta) * 60;
  return hue >= 5 && hue <= 52;
}

/**
 * 水平方向盒式模糊
 */
function blurFloatHorizontal(src, width, height, radius) {
  const out = new Float32Array(src.length);
  const size = radius * 2 + 1;
  const rightEdgeOffset = width - 1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const x = offset < 0 ? 0 : offset < width ? offset : rightEdgeOffset;
      sum += src[row + x];
    }
    for (let x = 0; x < width; x += 1) {
      out[row + x] = sum / size;
      const removeX = x > radius ? x - radius : 0;
      const addCandidate = x + radius + 1;
      const addX = addCandidate < width ? addCandidate : rightEdgeOffset;
      sum += src[row + addX] - src[row + removeX];
    }
  }
  return out;
}

/**
 * 可分离盒式模糊 (水平 + 垂直)
 */
function blurFloat(src, width, height, radius) {
  const r = Math.max(1, Math.floor(radius));
  const horizontal = blurFloatHorizontal(src, width, height, r);
  const out = new Float32Array(src.length);
  const size = r * 2 + 1;
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let offset = -r; offset <= r; offset += 1) {
      const y = offset < 0 ? 0 : offset < height ? offset : height - 1;
      sum += horizontal[y * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = sum / size;
      const removeY = y > r ? y - r : 0;
      const addCandidate = y + r + 1;
      const addY = addCandidate < height ? addCandidate : height - 1;
      sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
    }
  }
  return out;
}

/**
 * 生成源遮罩
 * @param {ImageData} imageData - 输入图像数据
 * @param {Object} params - 归一化后的参数
 * @returns {{ sourceLayer: {r,g,b,width,height}, masks: Object }}
 */
export function buildSourceMask(imageData, params) {
  const { width, height, data } = imageData;
  const total = width * height;
  const luma = new Float32Array(total);
  const maxChannelMap = new Float32Array(total);
  const minChannelMap = new Float32Array(total);
  const saturationMap = new Float32Array(total);

  // 第一遍: 计算每个像素的基础特征
  for (
    let index = 0, pixel = 0;
    pixel < total;
    pixel += 1, index += 4
  ) {
    const r = data[index] * (1 / 255);
    const g = data[index + 1] * (1 / 255);
    const b = data[index + 2] * (1 / 255);
    const maxChannel = r > g ? (r > b ? r : b) : g > b ? g : b;
    const minChannel = r < g ? (r < b ? r : b) : g < b ? g : b;
    luma[pixel] = r * 0.2126 + g * 0.7152 + b * 0.0722;
    maxChannelMap[pixel] = maxChannel;
    minChannelMap[pixel] = minChannel;
    saturationMap[pixel] =
      maxChannel <= 0 ? 0 : (maxChannel - minChannel) / maxChannel;
  }

  // 局部均值 (可分离盒式模糊)
  const localMean = blurFloat(luma, width, height, params.source.localRadius);

  // 输出数组
  const localContrast = new Float32Array(total);
  const lumaMask = new Float32Array(total);
  const contrastMask = new Float32Array(total);
  const whiteFlatMask = new Float32Array(total);
  const skinLikeMask = new Float32Array(total);
  const darkProtect = new Float32Array(total);
  const protectMask = new Float32Array(total);
  const sourceMask = new Float32Array(total);
  const sourceLayerR = new Float32Array(total);
  const sourceLayerG = new Float32Array(total);
  const sourceLayerB = new Float32Array(total);

  const sourceParams = params.source;
  const inv255 = 1 / 255;
  const thresholdLow = sourceParams.thresholdLow;
  const thresholdHigh = sourceParams.thresholdHigh;
  const thresholdKnee = sourceParams.thresholdKnee;
  const whiteProtect = sourceParams.whiteProtect;
  const skinProtect = sourceParams.skinProtect;
  const darkProtectAmount = sourceParams.darkProtect;
  const chromaBoostAmount = sourceParams.chromaBoost;

  // 第二遍: 计算遮罩
  for (
    let index = 0, pixel = 0;
    pixel < total;
    pixel += 1, index += 4
  ) {
    const r = data[index] * inv255;
    const g = data[index + 1] * inv255;
    const b = data[index + 2] * inv255;
    const lum = luma[pixel];
    const sat = saturationMap[pixel];
    const maxChannel = maxChannelMap[pixel];
    const contrast = Math.max(0, lum - localMean[pixel]);
    const specular = Math.max(0, maxChannel - localMean[pixel]);
    const brightness = Math.max(
      lum * 0.82 + maxChannel * 0.18,
      maxChannel * 0.88
    );

    const lumaScore =
      softThresholdMask(brightness, thresholdLow, thresholdKnee) *
      smoothstep(
        thresholdLow - thresholdKnee * 0.92,
        thresholdHigh,
        brightness
      );

    const contrastScore = smoothstep(
      sourceParams.contrastLow,
      sourceParams.contrastHigh,
      contrast
    );
    const specularScore = smoothstep(
      sourceParams.specularLow,
      sourceParams.specularHigh,
      specular
    );

    // 白色平坦区域保护
    const highLightness = smoothstep(0.7, 0.95, lum);
    const veryHighLightness = smoothstep(0.84, 0.985, lum);
    const lowContrast = 1 - smoothstep(0.01, 0.068, contrast);
    const lowSat = 1 - smoothstep(0.12, 0.36, sat);
    const whiteFlat =
      highLightness * lowContrast * lowSat * (0.72 + veryHighLightness * 0.5);

    // 肤色区域保护
    const skinHue = isSkinHueFast(r, g, b, maxChannel, minChannelMap[pixel])
      ? 1
      : 0;
    const skinColor =
      skinHue *
      smoothstep(0.16, 0.36, sat) *
      (1 - smoothstep(0.78, 0.96, sat)) *
      smoothstep(0.38, 0.74, lum) *
      (1 - smoothstep(0.9, 1, lum));

    // 暗部保护
    const dark = 1 - smoothstep(0.08, 0.28, lum);

    // 组合保护
    const protectionBase = clamp(
      whiteFlat * whiteProtect +
        skinColor * skinProtect +
        dark * darkProtectAmount,
      0,
      1
    );
    const nearClip = smoothstep(0.92, 1, maxChannel);
    const protection = clamp(
      protectionBase + nearClip * (0.12 + (1 - sat) * 0.1),
      0,
      1
    );

    // 边缘源和细节增强
    const chromaSource =
      smoothstep(0.08, 0.46, sat) * smoothstep(0.44, 0.84, brightness);
    const detailBoost = smoothstep(0.022, 0.12, contrast);
    const reflectiveBoost = clamp(
      0.48 +
        contrastScore * 0.44 +
        specularScore * 0.48 +
        chromaSource * 0.18 +
        detailBoost * 0.16,
      0,
      1.28
    );
    const edgeSource =
      Math.max(contrastScore * 0.2, specularScore * 0.4) *
      smoothstep(0.42, 0.9, brightness);

    // 最终遮罩
    const combinedSource =
      lumaScore * 0.82 + edgeSource * 0.38 + specularScore * 0.12;
    const mask = clamp(
      combinedSource * reflectiveBoost * (1 - protection * 0.82),
      0,
      1
    );

    // 源颜色 (带色度增强)
    const colorGain = Math.pow(mask, 0.78);
    const chromaBoost =
      chromaBoostAmount *
      smoothstep(0.06, 0.58, sat) *
      (0.62 + contrastScore * 0.26 + specularScore * 0.18);
    const saturationGain = 1 + chromaBoost;
    const sourceR = clamp(lum + (r - lum) * saturationGain, 0, 1);
    const sourceG = clamp(lum + (g - lum) * saturationGain, 0, 1);
    const sourceB = clamp(lum + (b - lum) * saturationGain, 0, 1);

    // 存储结果
    localContrast[pixel] = contrast;
    lumaMask[pixel] = lumaScore;
    contrastMask[pixel] = Math.max(contrastScore, specularScore * 0.72);
    whiteFlatMask[pixel] = whiteFlat;
    skinLikeMask[pixel] = skinColor;
    darkProtect[pixel] = dark;
    protectMask[pixel] = protection;
    sourceMask[pixel] = mask;
    sourceLayerR[pixel] = sourceR * colorGain;
    sourceLayerG[pixel] = sourceG * colorGain;
    sourceLayerB[pixel] = sourceB * colorGain;
  }

  return {
    width,
    height,
    sourceLayer: {
      width,
      height,
      r: sourceLayerR,
      g: sourceLayerG,
      b: sourceLayerB,
    },
    masks: {
      luma,
      localContrast,
      lumaMask,
      contrastMask,
      whiteFlatMask,
      skinLikeMask,
      darkProtect,
      protectMask,
      sourceMask,
    },
  };
}
