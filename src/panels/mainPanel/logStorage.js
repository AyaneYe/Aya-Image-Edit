import { LOG_LEVELS } from "./settingsStorage";

const LOG_FILE_RE = /^(error|warn|info|debug|trace)-(\d{4}-\d{2}-\d{2})\.log$/;

const pad2 = (value) => String(value).padStart(2, "0");

const formatDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getLocalFileSystem = () => {
  const uxp = require("uxp");
  return uxp.storage.localFileSystem;
};

const isFolderEntry = (entry) => entry && entry.isFolder;

const safeDeleteEntry = async (folder, entry) => {
  if (!entry || !folder) return;
  try {
    if (typeof folder.deleteEntry === "function") {
      await folder.deleteEntry(entry.name);
      return;
    }
  } catch {
    // fallback below
  }
  try {
    if (typeof entry.delete === "function") {
      await entry.delete();
    }
  } catch {
    // ignore
  }
};

const getOrCreateFile = async (folder, fileName) => {
  try {
    return await folder.getEntry(fileName);
  } catch {
    return await folder.createFile(fileName, { overwrite: false });
  }
};

const resolveCustomFolder = async (settings) => {
  const token = settings?.logCustomDirToken;
  if (!token || typeof token !== "string") return null;

  try {
    const fs = getLocalFileSystem();
    const entry = await fs.getEntryForPersistentToken(token);
    return isFolderEntry(entry) ? entry : null;
  } catch {
    return null;
  }
};

export async function resolveEffectiveLogDirectory(settings) {
  const fs = getLocalFileSystem();

  if (settings?.logDirMode === "custom") {
    const customFolder = await resolveCustomFolder(settings);
    if (customFolder) {
      return {
        folder: customFolder,
        source: "custom",
        hint: customFolder.nativePath || customFolder.name || "自定义目录",
      };
    }
  }

  const appFolder = await fs.getDataFolder();
  return {
    folder: appFolder,
    source: "appData",
    hint: appFolder.nativePath || appFolder.name || "插件数据目录",
  };
}

export async function pickCustomLogDirectory() {
  const fs = getLocalFileSystem();
  const folder = await fs.getFolder();
  if (!folder) return null;

  const token = await fs.createPersistentToken(folder);
  return {
    token,
    hint: folder.nativePath || folder.name || "自定义目录",
  };
}

export async function appendLogLine({ settings, level, line, date = new Date() }) {
  if (!LOG_LEVELS.includes(level)) return;

  const { folder } = await resolveEffectiveLogDirectory(settings);
  const fileName = `${level}-${formatDate(date)}.log`;
  const file = await getOrCreateFile(folder, fileName);
  await file.write(`${line}\n`, { append: true });
}

export async function cleanupOldLogs(settings, date = new Date()) {
  const retention = Number.parseInt(String(settings?.logRetentionDays ?? 7), 10);
  const retentionDays = Number.isFinite(retention) ? Math.max(1, retention) : 7;
  const cutoffAt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  cutoffAt.setDate(cutoffAt.getDate() - (retentionDays - 1));

  const { folder } = await resolveEffectiveLogDirectory(settings);
  const entries = await folder.getEntries().catch(() => []);

  for (const entry of entries) {
    if (!entry || entry.isFolder !== false) continue;
    const match = LOG_FILE_RE.exec(entry.name || "");
    if (!match) continue;

    const dateText = match[2];
    const y = Number.parseInt(dateText.slice(0, 4), 10);
    const m = Number.parseInt(dateText.slice(5, 7), 10);
    const d = Number.parseInt(dateText.slice(8, 10), 10);
    const fileDate = new Date(y, m - 1, d);
    if (Number.isNaN(fileDate.getTime())) continue;

    if (fileDate < cutoffAt) {
      await safeDeleteEntry(folder, entry);
    }
  }
}

export function getTodayLogKey(date = new Date()) {
  return formatDate(date);
}