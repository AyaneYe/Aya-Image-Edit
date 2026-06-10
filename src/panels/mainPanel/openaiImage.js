import { hostFetchResponses, hostFetchMultipart } from "../../bridge/hostBridge.js";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1/images/edits";
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_OPENAI_IMAGE_QUALITY = "high";

// Keep this aligned with manifest requiredPermissions domains.
export const OPENAI_COMPATIBLE_DOMAIN_PATTERNS = [
  "https://api.openai.com",
  "https://*.openai.com",
  "https://*",
];

function hasProtocol(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function normalizeOpenAIBaseUrl(value) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const withDefault = trimmed || DEFAULT_OPENAI_BASE_URL;
  const rawUrl = hasProtocol(withDefault) ? withDefault : `https://${withDefault}`;
  const url = new URL(rawUrl);

  if (url.protocol !== "https:") {
    throw new Error("自定义 API 地址必须使用 HTTPS，并且域名需要在白名单中。");
  }

  return url.href.replace(/\/+$/, "");
}

function patternMatchesUrl(pattern, url) {
  const match = /^([a-z][a-z0-9+.-]*):\/\/(.+)$/i.exec(pattern);
  if (!match) {
    return false;
  }

  const protocol = `${match[1].toLowerCase()}:`;
  const hostPattern = match[2].toLowerCase();
  const hostname = url.hostname.toLowerCase();

  if (url.protocol !== protocol) {
    return false;
  }

  if (hostPattern === "*") {
    return true;
  }

  if (hostPattern.startsWith("*.")) {
    const suffix = hostPattern.slice(1);
    return hostname === hostPattern.slice(2) || hostname.endsWith(suffix);
  }

  return hostname === hostPattern;
}

export function isOpenAIBaseUrlAllowed(value) {
  try {
    const normalized = normalizeOpenAIBaseUrl(value);
    const url = new URL(normalized);
    return OPENAI_COMPATIBLE_DOMAIN_PATTERNS.some((pattern) =>
      patternMatchesUrl(pattern, url)
    );
  } catch {
    return false;
  }
}

export function assertOpenAIBaseUrlAllowed(value) {
  if (!isOpenAIBaseUrlAllowed(value)) {
    throw new Error("自定义 API 域名未在白名单中，请使用 HTTPS 地址或更新 manifest 白名单。");
  }
}

export function buildOpenAIImageEditUrl(baseUrl) {
  assertOpenAIBaseUrlAllowed(baseUrl);
  return normalizeOpenAIBaseUrl(baseUrl);
}

function normalizeBase64Payload(value) {
  if (typeof value !== "string") {
    throw new Error("输入图片的 Base64 数据无效。");
  }

  let base64 = value.trim();
  if (base64.startsWith("data:")) {
    const commaIndex = base64.indexOf(",");
    if (commaIndex < 0) {
      throw new Error("输入图片的 Data URL 无效。");
    }
    base64 = base64.slice(commaIndex + 1);
  }

  base64 = base64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const mod = base64.length % 4;
  if (mod) {
    base64 += "=".repeat(4 - mod);
  }

  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) {
    throw new Error("输入图片的 Base64 数据格式错误。");
  }
  return base64;
}

function normalizeMimeType(value) {
  const mime = typeof value === "string" ? value.trim() : "";
  return /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : "image/png";
}

function extensionForMimeType(mimeType) {
  const normalized = normalizeMimeType(mimeType).toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") {
    return "jpg";
  }
  const extension = normalized.split("/")[1] || "png";
  return extension.replace(/[^a-z0-9]+/g, "") || "png";
}

// The OpenAI-compatible /images/edits endpoint infers the image format from the
// multipart file name, so it must be ASCII and carry an extension that matches
// the actual MIME. Captured canvas/layer images carry a human-readable, non-ASCII
// name with no extension (e.g. "当前画布"), which triggers a format_type_mismatch.
function safeImageFileName(rawName, mime, index) {
  const ext = extensionForMimeType(mime);
  const fallback = `image-${index + 1}.${ext}`;
  if (typeof rawName !== "string" || !rawName.trim()) {
    return fallback;
  }

  const baseNoExt = rawName.trim().replace(/\.[^.]+$/, "");
  const asciiBase = baseNoExt.replace(/[^a-zA-Z0-9._-]+/g, "");
  if (!asciiBase) {
    return fallback;
  }

  return `${asciiBase}.${ext}`;
}

function normalizeRequestImages({ inputImageBase64, inputImageMime, inputImages }) {
  if (Array.isArray(inputImages) && inputImages.length) {
    return inputImages
      .filter((item) => item?.base64)
      .map((item, index) => {
        const mime = normalizeMimeType(item.mime);
        return {
          base64: normalizeBase64Payload(item.base64),
          mime,
          fileName: safeImageFileName(item.fileName || item.name, mime, index),
        };
      });
  }

  if (!inputImageBase64) {
    return [];
  }

  const mime = normalizeMimeType(inputImageMime);
  return [
    {
      base64: normalizeBase64Payload(inputImageBase64),
      mime,
      fileName: `selection.${extensionForMimeType(mime)}`,
    },
  ];
}

function buildDataUrl(mimeType, base64Data) {
  const data = typeof base64Data === "string" ? base64Data.trim() : "";
  if (!data) {
    return "";
  }
  if (data.startsWith("data:")) {
    return data;
  }
  return `data:${normalizeMimeType(mimeType)};base64,${data}`;
}

function collectResponseItems(json) {
  if (Array.isArray(json?.data)) {
    return json.data;
  }
  if (Array.isArray(json?.output)) {
    return json.output;
  }
  return [];
}

export function parseOpenAIImages(json) {
  const urls = [];

  for (const item of collectResponseItems(json)) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const imageValue = item.image;
    const directUrl =
      item.url ||
      item.image_url ||
      item.imageUrl ||
      (typeof imageValue === "string" ? imageValue : imageValue?.url);

    if (typeof directUrl === "string" && directUrl.trim()) {
      urls.push(directUrl.trim());
      continue;
    }

    const base64 =
      item.b64_json ||
      item.b64Json ||
      item.base64 ||
      imageValue?.b64_json ||
      imageValue?.b64Json ||
      imageValue?.base64;

    if (typeof base64 === "string" && base64.trim()) {
      urls.push(buildDataUrl(item.mime_type || item.mimeType || imageValue?.mime_type, base64));
    }
  }

  return urls;
}

function parseJsonResponseBody(body) {
  if (typeof body !== "string" || !body.trim()) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function extractOpenAIError(json) {
  const error = json?.error;
  if (typeof error === "string") {
    return error;
  }
  return error?.message || json?.message || json?.detail || "";
}

// Derive the /v1/responses endpoint from whatever base URL is stored (full path or just origin).
export function buildOpenAIResponsesUrl(baseUrl) {
  assertOpenAIBaseUrlAllowed(baseUrl);
  const { origin } = new URL(normalizeOpenAIBaseUrl(baseUrl));
  return `${origin}/v1/responses`;
}

export function parseOpenAIResponsesImages(json) {
  const urls = [];

  for (const item of Array.isArray(json?.output) ? json.output : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    // Responses API primary format: { type: "image_generation_call", result: "<base64>" }
    if (item.type === "image_generation_call" && typeof item.result === "string" && item.result.trim()) {
      const raw = item.result.trim();
      urls.push(raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`);
      continue;
    }

    // Fallback: url / b64_json fields directly on the item
    const directUrl = item.url || item.image_url;
    if (typeof directUrl === "string" && directUrl.trim()) {
      urls.push(directUrl.trim());
      continue;
    }
    const b64 = item.b64_json || item.b64Json || item.base64;
    if (typeof b64 === "string" && b64.trim()) {
      urls.push(buildDataUrl(item.mime_type || item.mimeType || "image/png", b64.trim()));
    }
  }

  // Last resort: fall through to the standard /v1/images format parser
  return urls.length ? urls : parseOpenAIImages(json);
}

export async function openaiResponsesGenerate({
  apiKey,
  baseUrl,
  model,
  prompt,
  inputImages,
  generationMode,
}) {
  const endpoint = buildOpenAIResponsesUrl(baseUrl);
  const safeModel =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_OPENAI_IMAGE_MODEL;
  const safePrompt = typeof prompt === "string" ? prompt.trim() : "";

  const isTextMode = generationMode === "text";
  const normalizedImages = isTextMode ? [] : normalizeRequestImages({ inputImages });

  const content = [
    ...normalizedImages.map((img) => ({
      type: "input_image",
      image_url: `data:${img.mime};base64,${img.base64}`,
    })),
    { type: "input_text", text: safePrompt },
  ];

  const response = await hostFetchResponses(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: safeModel,
      input: [{ type: "message", role: "user", content }],
      stream: false,
    }),
  });

  const json = parseJsonResponseBody(response.body);

  if (!response.ok) {
    const message = extractOpenAIError(json) || response.statusText || "OpenAI Responses 请求失败。";
    throw new Error(message);
  }

  return json;
}

export async function openaiImageEditGenerate({
  apiKey,
  baseUrl,
  model,
  prompt,
  quality,
  inputImageBase64,
  inputImageMime,
  inputImages,
}) {
  const endpoint = buildOpenAIImageEditUrl(baseUrl);
  const safeModel =
    typeof model === "string" && model.trim() ? model.trim() : DEFAULT_OPENAI_IMAGE_MODEL;
  const safeQuality =
    typeof quality === "string" && quality.trim()
      ? quality.trim()
      : DEFAULT_OPENAI_IMAGE_QUALITY;
  const requestImages = normalizeRequestImages({ inputImageBase64, inputImageMime, inputImages });

  const response = await hostFetchMultipart(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    fields: [
      { name: "model", value: safeModel },
      { name: "prompt", value: typeof prompt === "string" ? prompt.trim() : "" },
      { name: "quality", value: safeQuality },
    ],
    files: requestImages.map((image) => ({
        name: "image[]",
        fileName: image.fileName,
        mimeType: image.mime,
        base64: image.base64,
      })),
    timeoutMs: 180000,
  });

  const json = parseJsonResponseBody(response.body);

  if (!response.ok) {
    const message = extractOpenAIError(json) || response.statusText || "OpenAI 请求失败。";
    throw new Error(message);
  }

  return json;
}
