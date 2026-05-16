import { hostFetchJson } from "../../bridge/hostBridge.js";

export function parseDashscopeImages(json) {
  const urls = [];
  const content =
    json?.output?.choices?.[0]?.message?.content ||
    json?.output?.choices?.[0]?.message?.content?.[0];

  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item.image === "string") {
        urls.push(item.image);
      }
    }
  }

  return urls;
}

export async function dashscopeGenerate({
  apiKey,
  model,
  prompt,
  inputImageBase64,
  inputImageMime,
  parameters,
}) {
  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            {
              image: `data:${inputImageMime};base64,${inputImageBase64}`,
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    },
    parameters,
  };

  const response = await hostFetchJson(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      timeoutMs: 120000,
    }
  );

  if (!response.ok) {
    const message = response.json?.message || response.statusText || "DashScope 请求失败。";
    throw new Error(message);
  }

  return response.json;
}
