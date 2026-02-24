const SETTINGS_FILE_NAME = "settings.json";

export const LOG_LEVELS = ["error", "warn", "info", "debug", "trace"];

const DEFAULT_LOG_LEVEL = "info";

const normalizeLogLevel = (value) =>
  LOG_LEVELS.includes(value) ? value : DEFAULT_LOG_LEVEL;

const normalizeLogDirMode = (value) =>
  value === "custom" ? "custom" : "appData";

const normalizeRetentionDays = (value) => {
  const parsed = Number.parseInt(String(value ?? 7), 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.max(1, Math.min(30, parsed));
};

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
  lastPrompt: "",
  debugEnabled: false,
  logLevel: DEFAULT_LOG_LEVEL,
  logDumpEnabled: true,
  logDirMode: "appData",
  logCustomDirToken: "",
  logRetentionDays: 7,
  logRedactionEnabled: true,
};

export function normalizeSettings(settings) {
  const merged = { ...defaultSettings, ...(settings || {}) };

  return {
    ...merged,
    provider: merged.provider === "gemini" ? "gemini" : "dashscope",
    autoSendMode: ["off", "original", "selection"].includes(merged.autoSendMode)
      ? merged.autoSendMode
      : "off",
    debugEnabled: Boolean(merged.debugEnabled),
    logLevel: normalizeLogLevel(merged.logLevel),
    logDumpEnabled: Boolean(merged.logDumpEnabled),
    logDirMode: normalizeLogDirMode(merged.logDirMode),
    logCustomDirToken:
      typeof merged.logCustomDirToken === "string" ? merged.logCustomDirToken : "",
    logRetentionDays: normalizeRetentionDays(merged.logRetentionDays),
    logRedactionEnabled: Boolean(merged.logRedactionEnabled),
  };
}

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
    return normalizeSettings(JSON.parse(raw));
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
    await file.write(JSON.stringify(normalizeSettings(settings), null, 2));
  } catch {
    // ignore
  }
}
