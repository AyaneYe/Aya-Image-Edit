export const defaultSettings = {
  provider: "dashscope",
  apiKey: "",
  model: "qwen-image-edit-max",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash-image",
  geminiAspectRatio: "",
  geminiImageSize: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1/images/edits",
  openaiModel: "gpt-image-2",
  openaiQuality: "high",
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

export const OPENAI_QUALITY_OPTIONS = ["high", "medium", "low", "auto"];
