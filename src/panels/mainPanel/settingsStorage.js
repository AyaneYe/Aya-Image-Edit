import { readSettingsFromHost, writeSettingsToHost } from "../../bridge/hostBridge.js";
import { defaultSettings } from "./sharedSettings.js";

export { defaultSettings } from "./sharedSettings.js";

export async function readSettingsFromDisk() {
  try {
    const settings = await readSettingsFromHost();
    return { ...defaultSettings, ...settings };
  } catch {
    return defaultSettings;
  }
}

export async function writeSettingsToDisk(settings) {
  try {
    await writeSettingsToHost(settings);
  } catch {
    // Ignore save failures and keep the panel interactive.
  }
}
