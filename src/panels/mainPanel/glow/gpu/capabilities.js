/**
 * WebGL2 能力检测模块
 */

let cachedResult = null;

/**
 * 检测当前环境是否支持 WebGL2 且能处理给定尺寸
 * @param {number} width - 图像宽度
 * @param {number} height - 图像高度
 * @returns {boolean}
 */
export function canUseWebgl2(width, height) {
  if (cachedResult !== null) return cachedResult;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    if (!gl) {
      cachedResult = false;
      return false;
    }

    // 检查最大纹理尺寸
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (width > maxTextureSize || height > maxTextureSize) {
      cachedResult = false;
      return false;
    }

    // 检查是否支持 MRT (Multiple Render Targets)
    const drawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
    if (drawBuffers < 2) {
      cachedResult = false;
      return false;
    }

    // 检查浮点纹理支持
    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      // 尝试使用半精度
      const halfFloat = gl.getExtension("EXT_color_buffer_half_float");
      if (!halfFloat) {
        cachedResult = false;
        return false;
      }
    }

    // 清理测试上下文
    const loseContext = gl.getExtension("WEBGL_lose_context");
    if (loseContext) loseContext.loseContext();

    cachedResult = true;
    return true;
  } catch (e) {
    cachedResult = false;
    return false;
  }
}

/**
 * 重置缓存 (用于测试)
 */
export function resetCapabilityCache() {
  cachedResult = null;
}
