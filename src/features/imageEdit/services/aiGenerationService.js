import {
  dashscopeGenerate,
  parseDashscopeImages,
} from "../providers/dashscopeProvider";
import {
  geminiBananaGenerate,
  parseGeminiBananaImages,
} from "../providers/geminiProvider";

export const PROVIDER_DASHSCOPE = "dashscope";
export const PROVIDER_GEMINI = "gemini";

export function normalizeProvider(value) {
  return value === PROVIDER_GEMINI ? PROVIDER_GEMINI : PROVIDER_DASHSCOPE;
}

export function getProviderLabel(provider) {
  const safeProvider = normalizeProvider(provider);
  return safeProvider === PROVIDER_GEMINI ? "Gemini Banana" : "DashScope";
}

export function getProviderApiKey(settings, provider) {
  const safeProvider = normalizeProvider(provider);
  if (safeProvider === PROVIDER_GEMINI) {
    return settings?.geminiApiKey || "";
  }
  return settings?.apiKey || "";
}

export function getProviderModel(settings, provider) {
  const safeProvider = normalizeProvider(provider);
  if (safeProvider === PROVIDER_GEMINI) {
    return settings?.geminiModel || "gemini-2.5-flash-image";
  }
  return settings?.model || "qwen-image-edit-max";
}

export async function generateImageByProvider({
  settings,
  prompt,
  inputImageBase64,
  inputImageMime,
  dashscopeParameters
}) {
  const provider = normalizeProvider(settings?.provider);

  if (provider === PROVIDER_GEMINI) {
    const json = await geminiBananaGenerate({
      apiKey: getProviderApiKey(settings, provider),
      model: getProviderModel(settings, provider),
      prompt,
      inputImageBase64,
      inputImageMime,
      aspectRatio: settings?.geminiAspectRatio,
      imageSize: settings?.geminiImageSize
    });
    return {
      provider,
      json,
      urls: parseGeminiBananaImages(json)
    };
  }

  const json = await dashscopeGenerate({
    apiKey: getProviderApiKey(settings, provider),
    model: getProviderModel(settings, provider),
    prompt,
    inputImageBase64,
    inputImageMime,
    parameters: dashscopeParameters
  });

  return {
    provider,
    json,
    urls: parseDashscopeImages(json)
  };
}
