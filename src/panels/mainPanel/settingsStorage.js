const SETTINGS_FILE_NAME = "settings.json";

export const defaultSettings = {
  provider: "dashscope",
  apiKey: "",
  model: "qwen-image-edit-max",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash-image",
  geminiAspectRatio: "",
  geminiImageSize: "",
  // n is kept for backward compatibility with existing settings.json
  n: 1,
  negative_prompt: "",
  prompt_extend: true,
  watermark: false,
  size: "",
  // Preview behavior (off | original | selection)
  autoSendMode: "off",
  // Persist last prompt for convenience
  lastPrompt: ""
};

export async function readSettingsFromDisk() {
  try {
    const uxp = require("uxp");
    const fs = uxp.storage.localFileSystem;
    const folder = await fs.getDataFolder();

    let file = null;
    try {
      file = await folder.getEntry(SETTINGS_FILE_NAME);
    } catch {
      return defaultSettings;
    }

    const raw = await file.read();
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export async function writeSettingsToDisk(settings) {
  try {
    const uxp = require("uxp");
    const fs = uxp.storage.localFileSystem;
    const folder = await fs.getDataFolder();
    const file = await folder.createFile(SETTINGS_FILE_NAME, { overwrite: true });
    await file.write(JSON.stringify(settings, null, 2));
  } catch {
    // ignore
  }
}
