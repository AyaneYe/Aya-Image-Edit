import { dashscopeGenerate, parseDashscopeImages } from "./dashscope";
import { geminiBananaGenerate, parseGeminiBananaImages } from "./geminiBanana";
import { createLogger } from "./logger";

const logger = createLogger("aiProvider");

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
  const startedAt = Date.now();

  logger.info("request.start", "Provider 请求开始", {
    provider,
    model: getProviderModel(settings, provider),
    prompt,
    inputImageBase64,
    inputImageMime,
  });

  try {
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
      const urls = parseGeminiBananaImages(json);
      logger.info("request.success", "Provider 请求成功", {
        provider,
        generatedCount: urls.length,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        provider,
        json,
        urls,
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

    const urls = parseDashscopeImages(json);
    logger.info("request.success", "Provider 请求成功", {
      provider,
      generatedCount: urls.length,
      elapsedMs: Date.now() - startedAt,
    });

    return {
      provider,
      json,
      urls,
    };
  } catch (error) {
    logger.error("request.failed", "Provider 请求失败", {
      provider,
      elapsedMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}
