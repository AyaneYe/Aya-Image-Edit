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
    throw new Error(msg);
  }
  return json;
}
