import { hostFetchJson } from "../../../bridge/hostBridge.js";

export function parseQwenImages(json) {
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

function normalizeInputImages({ inputImageBase64, inputImageMime, inputImages }) {
  if (Array.isArray(inputImages) && inputImages.length) {
    return inputImages
      .filter((item) => item?.base64)
      .map((item) => ({
        base64: item.base64,
        mime: item.mime || "image/png",
      }));
  }

  if (!inputImageBase64) {
    return [];
  }

  return [
    {
      base64: inputImageBase64,
      mime: inputImageMime || "image/png",
    },
  ];
}

export async function qwenGenerate({
  apiKey,
  model,
  prompt,
  inputImageBase64,
  inputImageMime,
  inputImages,
  parameters,
}) {
  const images = normalizeInputImages({ inputImageBase64, inputImageMime, inputImages });
  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            ...images.map((image) => ({
              image: `data:${image.mime};base64,${image.base64}`,
            })),
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
    const message = response.json?.message || response.statusText || "Qwen 请求失败。";
    throw new Error(message);
  }

  return response.json;
}
