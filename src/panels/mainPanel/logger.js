import { defaultSettings, normalizeSettings } from "./settingsStorage";
import {
  appendLogLine,
  cleanupOldLogs,
  getTodayLogKey,
  resolveEffectiveLogDirectory,
} from "./logStorage";

const LEVEL_PRIORITY = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const DEFAULT_RUNTIME = normalizeSettings(defaultSettings);

let runtimeSettings = {
  debugEnabled: DEFAULT_RUNTIME.debugEnabled,
  logLevel: DEFAULT_RUNTIME.logLevel,
  logDumpEnabled: DEFAULT_RUNTIME.logDumpEnabled,
  logDirMode: DEFAULT_RUNTIME.logDirMode,
  logCustomDirToken: DEFAULT_RUNTIME.logCustomDirToken,
  logRetentionDays: DEFAULT_RUNTIME.logRetentionDays,
  logRedactionEnabled: DEFAULT_RUNTIME.logRedactionEnabled,
};

let writeQueue = Promise.resolve();
let cleanedDayKey = "";

const shouldWriteLevel = (level) => {
  if (!runtimeSettings.debugEnabled || !runtimeSettings.logDumpEnabled) return false;
  const currentPriority = LEVEL_PRIORITY[runtimeSettings.logLevel] ?? LEVEL_PRIORITY.info;
  const levelPriority = LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info;
  return levelPriority <= currentPriority;
};

const truncatePrompt = (value) => {
  const text = String(value ?? "");
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

const maskSecret = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= 6) return "***";
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
};

const base64LengthFromDataUrl = (value) => {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const marker = ";base64,";
  const idx = value.indexOf(marker);
  if (idx < 0) return null;
  return value.slice(idx + marker.length).replace(/\s+/g, "").length;
};

const isSensitiveKey = (key) => /api[-_]?key|authorization|token|secret/i.test(key);
const isPromptKey = (key) => /prompt/i.test(key);
const isBase64Key = (key) => /base64|imageData|inline_data|inlineData|image/i.test(key);

const sanitizeValue = (value, key = "", depth = 0) => {
  if (value == null) return value;
  if (depth > 6) return "[MaxDepth]";

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (typeof value === "string") {
    const dataUrlLength = base64LengthFromDataUrl(value);
    if (dataUrlLength != null) {
      return { base64Length: dataUrlLength };
    }
    if (isSensitiveKey(key)) return maskSecret(value);
    if (isPromptKey(key)) return truncatePrompt(value);
    if (isBase64Key(key) && value.length > 64) {
      return { base64Length: value.replace(/\s+/g, "").length };
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, depth + 1));
  }

  if (typeof value === "object") {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      output[childKey] = sanitizeValue(childValue, childKey, depth + 1);
    }
    return output;
  }

  return String(value);
};

const sanitizeMessage = (message) => {
  const text = String(message ?? "");
  return text.length > 400 ? `${text.slice(0, 400)}...` : text;
};

const queueTask = (task) => {
  writeQueue = writeQueue.then(task).catch(() => undefined);
  return writeQueue;
};

const ensureDailyCleanup = async (date = new Date()) => {
  const dayKey = getTodayLogKey(date);
  if (dayKey === cleanedDayKey) return;
  cleanedDayKey = dayKey;
  await cleanupOldLogs(runtimeSettings, date).catch(() => undefined);
};

export function configureLoggerFromSettings(settings) {
  const normalized = normalizeSettings(settings || {});
  runtimeSettings = {
    ...runtimeSettings,
    debugEnabled: Boolean(normalized.debugEnabled),
    logLevel: normalized.logLevel,
    logDumpEnabled: Boolean(normalized.logDumpEnabled),
    logDirMode: normalized.logDirMode,
    logCustomDirToken: normalized.logCustomDirToken,
    logRetentionDays: normalized.logRetentionDays,
    logRedactionEnabled: Boolean(normalized.logRedactionEnabled),
  };
}

export async function getLoggerDirectoryInfo() {
  const info = await resolveEffectiveLogDirectory(runtimeSettings);
  return {
    source: info.source,
    hint: info.hint,
  };
}

export function logEvent(level, event, message, context) {
  if (!shouldWriteLevel(level)) return;

  const safeContext = runtimeSettings.logRedactionEnabled
    ? sanitizeValue(context || {})
    : context || {};
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    message: runtimeSettings.logRedactionEnabled ? sanitizeMessage(message) : String(message || ""),
    context: safeContext,
  });

  queueTask(async () => {
    await ensureDailyCleanup();
    await appendLogLine({ settings: runtimeSettings, level, line });
  });
}

export function createLogger(scope) {
  const safeScope = scope || "app";

  const buildEvent = (event) => `${safeScope}.${event}`;
  return {
    error: (event, message, context) =>
      logEvent("error", buildEvent(event), message, context),
    warn: (event, message, context) =>
      logEvent("warn", buildEvent(event), message, context),
    info: (event, message, context) =>
      logEvent("info", buildEvent(event), message, context),
    debug: (event, message, context) =>
      logEvent("debug", buildEvent(event), message, context),
    trace: (event, message, context) =>
      logEvent("trace", buildEvent(event), message, context),
  };
}