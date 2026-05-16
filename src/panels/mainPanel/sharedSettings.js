export const defaultSettings = {
  provider: "dashscope",
  apiKey: "",
  model: "qwen-image-edit-max",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash-image",
  geminiAspectRatio: "",
  geminiImageSize: "",
  n: 1,
  negative_prompt: "",
  prompt_extend: true,
  watermark: false,
  size: "",
  autoSendMode: "off",
  lastPrompt: "",
};

export const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
];
