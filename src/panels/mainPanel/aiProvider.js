import { qwenGenerate, parseQwenImages } from "./qwen.js";
import { geminiBananaGenerate, parseGeminiBananaImages } from "./geminiBanana.js";
import {
  openaiResponsesGenerate,
  parseOpenAIResponsesImages,
} from "./openaiImage.js";

export const PROVIDER_QWEN = "qwen";
export const PROVIDER_GEMINI = "gemini";
export const PROVIDER_OPENAI = "openai";

export function normalizeProvider(value) {
  if (value === PROVIDER_GEMINI) {
    return PROVIDER_GEMINI;
  }
  if (value === PROVIDER_OPENAI) {
    return PROVIDER_OPENAI;
  }
  return PROVIDER_QWEN;
}

export function getProviderLabel(provider) {
  const safeProvider = normalizeProvider(provider);
  if (safeProvider === PROVIDER_GEMINI) {
    return "Gemini";
  }
  if (safeProvider === PROVIDER_OPENAI) {
    return "OpenAI";
  }
  return "Qwen";
}

export function getProviderApiKey(settings, provider) {
  const safeProvider = normalizeProvider(provider);
  if (safeProvider === PROVIDER_GEMINI) {
    return settings?.geminiApiKey || "";
  }
  if (safeProvider === PROVIDER_OPENAI) {
    return settings?.openaiApiKey || "";
  }
  return settings?.apiKey || "";
}

export function getProviderModel(settings, provider) {
  const safeProvider = normalizeProvider(provider);
  if (safeProvider === PROVIDER_GEMINI) {
    return settings?.geminiModel || "gemini-2.5-flash-image";
  }
  if (safeProvider === PROVIDER_OPENAI) {
    return settings?.openaiModel || "gpt-image-2";
  }
  return settings?.model || "qwen-image-edit-max";
}

export async function generateImageByProvider({
  settings,
  prompt,
  inputImageBase64,
  inputImageMime,
  inputImages,
  generationMode,
  qwenParameters,
}) {
  const provider = normalizeProvider(settings?.provider);

  if (provider === PROVIDER_GEMINI) {
    const json = await geminiBananaGenerate({
      apiKey: getProviderApiKey(settings, provider),
      model: getProviderModel(settings, provider),
      prompt,
      inputImageBase64,
      inputImageMime,
      inputImages,
      aspectRatio: settings?.geminiAspectRatio,
      imageSize: settings?.geminiImageSize,
    });
    return {
      provider,
      json,
      urls: parseGeminiBananaImages(json),
    };
  }

  if (provider === PROVIDER_OPENAI) {
    const json = await openaiResponsesGenerate({
      apiKey: getProviderApiKey(settings, provider),
      baseUrl: settings?.openaiBaseUrl,
      model: getProviderModel(settings, provider),
      prompt,
      inputImages,
      generationMode,
    });
    return {
      provider,
      json,
      urls: parseOpenAIResponsesImages(json),
    };
  }

  const json = await qwenGenerate({
    apiKey: getProviderApiKey(settings, provider),
    model: getProviderModel(settings, provider),
    prompt,
    inputImageBase64,
    inputImageMime,
    inputImages,
    parameters: qwenParameters,
  });

  return {
    provider,
    json,
    urls: parseQwenImages(json),
  };
}
