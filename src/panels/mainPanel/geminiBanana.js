import { createLogger } from "./logger";

const logger = createLogger("gemini");

function normalizeInlineData(part) {
  return part?.inlineData || part?.inline_data || null;
}

function normalizeBase64Payload(value) {
  if (typeof value !== "string") {
    throw new Error("输入图片编码无效：base64 不是字符串");
  }

  let base64 = value.trim();
  if (base64.startsWith("data:")) {
    const comma = base64.indexOf(",");
    if (comma < 0) {
      throw new Error("输入图片编码无效：data URL 缺少逗号分隔");
    }
    base64 = base64.slice(comma + 1);
  }

  base64 = base64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64.length % 4;
  if (mod) base64 += "=".repeat(4 - mod);

  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new Error("输入图片编码无效：不是合法 base64");
  }
  return base64;
}

function normalizeMimeType(value) {
  const mime = typeof value === "string" ? value.trim() : "";
  return /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : "image/png";
}

function buildImageDataUrl(mimeType, base64Data) {
  const mime = typeof mimeType === "string" && mimeType.trim() ? mimeType : "image/png";
  return `data:${mime};base64,${base64Data}`;
}

export function parseGeminiBananaImages(json) {
  const urls = [];
  const candidates = Array.isArray(json?.candidates) ? json.candidates : [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      const inline = normalizeInlineData(part);
      const data = inline?.data;
      if (typeof data === "string" && data.trim()) {
        urls.push(buildImageDataUrl(inline?.mimeType || inline?.mime_type, data));
      }
    }
  }

  return urls;
}

function buildGenerationConfig({ aspectRatio, imageSize }) {
  const config = {
    response_modalities: ["TEXT", "IMAGE"]
  };

  const imageConfig = {};
  if (typeof aspectRatio === "string" && aspectRatio.trim()) {
    imageConfig.aspect_ratio = aspectRatio.trim();
  }
  if (typeof imageSize === "string" && imageSize.trim()) {
    imageConfig.image_size = imageSize.trim();
  }

  if (Object.keys(imageConfig).length) {
    config.image_config = imageConfig;
  }

  return config;
}

function buildBody({ prompt, inputImageBase64, inputImageMime, aspectRatio, imageSize }) {
  const normalizedBase64 = normalizeBase64Payload(inputImageBase64);
  const normalizedMime = normalizeMimeType(inputImageMime);

  const parts = [];
  if (typeof prompt === "string" && prompt.trim()) {
    parts.push({ text: prompt.trim() });
  }
  parts.push({
    inline_data: {
      mime_type: normalizedMime,
      data: normalizedBase64
    }
  });

  return {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    generation_config: buildGenerationConfig({ aspectRatio, imageSize })
  };
}

function tryExtractGeminiError(json) {
  return (
    json?.error?.message ||
    json?.message ||
    json?.promptFeedback?.blockReason ||
    json?.candidates?.[0]?.finishMessage ||
    ""
  );
}

export async function geminiBananaGenerate({
  apiKey,
  model,
  prompt,
  inputImageBase64,
  inputImageMime,
  aspectRatio,
  imageSize
}) {
  const startedAt = Date.now();
  const safeModel =
    typeof model === "string" && model.trim()
      ? model.trim()
      : "gemini-2.5-flash-image";

  const body = buildBody({
    prompt,
    inputImageBase64,
    inputImageMime,
    aspectRatio,
    imageSize
  });

  logger.debug("request.start", "Gemini 请求发起", {
    model: safeModel,
    prompt,
    inputImageBase64,
    inputImageMime,
    aspectRatio,
    imageSize,
  });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = tryExtractGeminiError(json) || res.statusText;
    logger.error("request.failed", "Gemini 请求失败", {
      status: res.status,
      statusText: res.statusText,
      elapsedMs: Date.now() - startedAt,
      message: msg,
    });
    throw new Error(msg);
  }

  const finishReason = json?.candidates?.[0]?.finishReason;
  if (finishReason === "NO_IMAGE") {
    logger.warn("request.noImage", "Gemini 未返回图片", {
      elapsedMs: Date.now() - startedAt,
      finishReason,
    });
    throw new Error("模型未返回图片，请尝试调整提示词或更换模型");
  }

  logger.info("request.success", "Gemini 请求成功", {
    status: res.status,
    elapsedMs: Date.now() - startedAt,
    imageCount: parseGeminiBananaImages(json).length,
  });

  return json;
}
