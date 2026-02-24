import { createLogger } from "./logger";

const logger = createLogger("dashscope");

export function parseDashscopeImages(json) {
  const urls = [];
  const content =
    json?.output?.choices?.[0]?.message?.content ||
    json?.output?.choices?.[0]?.message?.content?.[0];

  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item.image === "string") urls.push(item.image);
    }
  }
  return urls;
}

export async function dashscopeGenerate({ apiKey, model, prompt, inputImageBase64, inputImageMime, parameters }) {
  const startedAt = Date.now();
  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            {
              image: `data:${inputImageMime};base64,${inputImageBase64}`
            },
            {
              text: prompt
            }
          ]
        }
      ]
    },
    parameters
  };

  logger.debug("request.start", "DashScope 请求发起", {
    model,
    prompt,
    inputImageBase64,
    inputImageMime,
    parameters,
  });

  const res = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || res.statusText;
    logger.error("request.failed", "DashScope 请求失败", {
      status: res.status,
      statusText: res.statusText,
      elapsedMs: Date.now() - startedAt,
      message: msg,
    });
    throw new Error(msg);
  }

  logger.info("request.success", "DashScope 请求成功", {
    status: res.status,
    elapsedMs: Date.now() - startedAt,
    imageCount: parseDashscopeImages(json).length,
  });
  return json;
}
