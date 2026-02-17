function normalizeInlineData(part) {
  return part?.inlineData || part?.inline_data || null;
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
    responseModalities: ["TEXT", "IMAGE"]
  };

  const imageConfig = {};
  if (typeof aspectRatio === "string" && aspectRatio.trim()) {
    imageConfig.aspectRatio = aspectRatio.trim();
  }
  if (typeof imageSize === "string" && imageSize.trim()) {
    imageConfig.imageSize = imageSize.trim();
  }

  if (Object.keys(imageConfig).length) {
    config.imageConfig = imageConfig;
  }

  return config;
}

function buildBody({ prompt, inputImageBase64, inputImageMime, aspectRatio, imageSize }) {
  const parts = [];
  if (typeof prompt === "string" && prompt.trim()) {
    parts.push({ text: prompt.trim() });
  }
  parts.push({
    inlineData: {
      mimeType: inputImageMime,
      data: inputImageBase64
    }
  });

  return {
    contents: [
      {
        role: "user",
        parts
      }
    ],
    generationConfig: buildGenerationConfig({ aspectRatio, imageSize })
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
    throw new Error(msg);
  }

  const finishReason = json?.candidates?.[0]?.finishReason;
  if (finishReason === "NO_IMAGE") {
    throw new Error("模型未返回图片，请尝试调整提示词或更换模型");
  }

  return json;
}
