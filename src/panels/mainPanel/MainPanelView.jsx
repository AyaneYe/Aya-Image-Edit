import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  generateImageByProvider,
  getProviderApiKey,
  getProviderLabel,
  normalizeProvider,
  PROVIDER_DASHSCOPE,
  PROVIDER_GEMINI,
} from "./aiProvider";
import { placeImageUrlAtBounds } from "./placeImage";
import { getSelectionBounds, selectionToImageBase64 } from "./psSelection";
import {
  defaultSettings,
  readSettingsFromDisk,
  writeSettingsToDisk,
} from "./settingsStorage";
import {
  clampImageCount,
  GEMINI_MODEL_OPTIONS,
  ProviderAdvancedOptions,
} from "./components/ProviderAdvancedOptions";
import {
  btnBase,
  btnGhost,
  btnPrimary,
  card,
  cardMeta,
  cardTitle,
  errorBox,
  fieldBase,
  feedbackStack,
  helperText,
  labelText,
  panelRoot,
  sectionTitle,
  statusBox,
  tabBase,
  tabActive,
  tabInactive,
  tabList,
  textareaBase,
} from "./styles";

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch() {
    // no-op
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col gap-2">
          <div className="text-sm">面板发生错误</div>
          <div className="text-xs text-red-600 break-words">
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainPanelInner = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [settings, setSettings] = useState(defaultSettings);
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [showingPreview, setShowingPreview] = useState(false);
  const [previewImageList, setPreviewImageList] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const settingsSaveTimerRef = useRef(null);

  const previewCurrent = previewImageList.length
    ? previewImageList[Math.min(previewIndex, previewImageList.length - 1)]
    : null;
  const activeProvider = normalizeProvider(settings.provider);
  const isGeminiProvider = activeProvider === PROVIDER_GEMINI;
  const isDashscopeProvider = activeProvider === PROVIDER_DASHSCOPE;

  const safeRevokeObjectUrl = (maybeUrl) => {
    if (
      typeof maybeUrl === "string" &&
      maybeUrl.startsWith("blob:") &&
      typeof URL?.revokeObjectURL === "function"
    ) {
      try {
        URL.revokeObjectURL(maybeUrl);
      } catch {
        // ignore
      }
    }
  };

  const decodeBase64ToBytes = (base64) => {
    const clean = String(base64 || "").replace(/\s+/g, "");

    if (typeof atob === "function") {
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    if (typeof Buffer !== "undefined") {
      const buf = Buffer.from(clean, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    throw new Error("当前环境不支持 base64 解码");
  };

  const tryDataUrlToArrayBuffer = (url) => {
    if (typeof url !== "string" || !url.startsWith("data:")) return null;

    const commaIndex = url.indexOf(",");
    if (commaIndex < 0) throw new Error("data URL 无效");

    const meta = url.slice(5, commaIndex);
    const payload = url.slice(commaIndex + 1);

    if (/;base64/i.test(meta)) {
      const bytes = decodeBase64ToBytes(payload);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }

    const text = decodeURIComponent(payload);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff;
    }
    return bytes.buffer;
  };

  const fetchArrayBuffer = async (url) => {
    const dataBuffer = tryDataUrlToArrayBuffer(url);
    if (dataBuffer) return dataBuffer;

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 30000);
    const res = await fetch(url, { signal: controller?.signal }).finally(() =>
      clearTimeout(timeout),
    );
    if (!res.ok) throw new Error(`请求失败: ${res.status} ${res.statusText}`);
    return await res.arrayBuffer();
  };

  const inferImageMimeType = (url) => {
    if (typeof url === "string" && url.startsWith("data:")) {
      const commaIndex = url.indexOf(",");
      const meta = commaIndex > 5 ? url.slice(5, commaIndex) : "";
      const semiIndex = meta.indexOf(";");
      const mime = semiIndex >= 0 ? meta.slice(0, semiIndex) : meta;
      if (mime) return mime;
    }
    return "image/png";
  };

  const tryCreatePreviewObjectUrl = async (url) => {
    try {
      if (
        typeof Blob === "undefined" ||
        typeof URL?.createObjectURL !== "function"
      )
        return null;
      const buf = await fetchArrayBuffer(url);
      const blob = new Blob([buf], { type: inferImageMimeType(url) });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  const downloadAndSaveImage = async (url) => {
    const uxp = require("uxp");
    const fs = uxp.storage.localFileSystem;
    const formats = uxp.storage.formats;

    const buf = await fetchArrayBuffer(url);

    try {
      const file = await fs.getFileForSaving(`aya-result-${Date.now()}.png`);
      if (!file) return { saved: false, reason: "canceled" }; // user canceled
      await file.write(buf, { format: formats.binary });
      return { saved: true, target: file.nativePath || file.name };
    } catch (e) {
      const msg = e?.message || String(e);
      if (/not permitted|file picker|Manifest entry not found/i.test(msg)) {
        throw new Error(
          "插件未获得文件选择器权限：请确认 manifest.json 已包含 requiredPermissions.localFileSystem，并在 PS 中重新加载插件后再试",
        );
      }
      throw e;
    }
  };

  const tabs = useMemo(
    () => [
      { id: "home", label: "主页" },
      { id: "settings", label: "设置" },
    ],
    [],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loaded = await readSettingsFromDisk();
      if (mounted) {
        setSettings(loaded);
        setPrompt(
          typeof loaded.lastPrompt === "string" ? loaded.lastPrompt : "",
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }
    settingsSaveTimerRef.current = setTimeout(() => {
      writeSettingsToDisk({ ...settings, lastPrompt: prompt });
    }, 300);
    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
        settingsSaveTimerRef.current = null;
      }
    };
  }, [settings, prompt]);

  useEffect(() => {
    // Keep index valid when list changes
    setPreviewIndex((i) => {
      if (!previewImageList.length) return 0;
      return Math.max(0, Math.min(i, previewImageList.length - 1));
    });
  }, [previewImageList.length]);

  const onGenerate = async () => {
    setError("");
    setStatus("");

    const providerApiKey = getProviderApiKey(settings, activeProvider);
    if (!providerApiKey) {
      setActiveTab("settings");
      setError(`请先在设置中填写 ${getProviderLabel(activeProvider)} API Key`);
      return;
    }
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }

    setIsBusy(true);
    try {
      setStatus("读取选区并编码...");
      const photoshop = require("photoshop");
      const docIdAtStart = photoshop?.app?.activeDocument?.id;
      const {
        bounds: boundsAtStart,
        base64,
        mime,
      } = await selectionToImageBase64();

      const cleanedNegative =
        typeof settings.negative_prompt === "string"
          ? settings.negative_prompt.trim()
          : "";
      const cleanedSize =
        typeof settings.size === "string" ? settings.size.trim() : "";
      const safeRequestedCount = clampImageCount(settings.n);

      const dashscopeParameters = isDashscopeProvider
        ? {
            n: safeRequestedCount,
            // Some backends reject empty string; keep empty in UI but send a safe fallback.
            negative_prompt: cleanedNegative.length ? cleanedNegative : " ",
            prompt_extend: Boolean(settings.prompt_extend),
            watermark: Boolean(settings.watermark),
            ...(cleanedSize.length ? { size: cleanedSize } : null),
          }
        : null;

      setStatus(`请求 ${getProviderLabel(activeProvider)} 生成中...`);
      const { urls } = await generateImageByProvider({
        settings,
        prompt,
        inputImageBase64: base64,
        inputImageMime: mime,
        dashscopeParameters,
      });

      if (!urls.length) throw new Error("响应中没有找到可用图片");

      setStatus(`已生成 ${urls.length} 张，准备预览...`);

      const newItems = urls.map((url, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        url,
        blobUrl: null,
        docId: docIdAtStart,
        boundsAtStart,
      }));

      setPreviewImageList((list) => [...newItems, ...list]);
      setPreviewIndex(0);
      setShowingPreview(true);

      // Best-effort: create blob URL so <img> renders reliably.
      const blobPairs = await Promise.all(
        newItems.map(async (item) => ({
          id: item.id,
          blobUrl: await tryCreatePreviewObjectUrl(item.url),
        })),
      );

      const blobMap = new Map(
        blobPairs.filter((it) => it.blobUrl).map((it) => [it.id, it.blobUrl]),
      );
      if (blobMap.size) {
        setPreviewImageList((list) =>
          list.map((it) => {
            const blobUrl = blobMap.get(it.id);
            return blobUrl ? { ...it, blobUrl } : it;
          }),
        );
      }

      const mode = settings.autoSendMode || "off";
      if (mode !== "off") {
        setStatus(
          mode === "selection"
            ? "Auto Send：贴回选区..."
            : "Auto Send：贴回原位置...",
        );
        const targetBounds =
          mode === "selection" ? getSelectionBounds() : boundsAtStart;
        await placeImageUrlAtBounds(urls[0], targetBounds);
        setStatus("完成");
      } else {
        setStatus("已加入预览");
      }
    } catch (e) {
      setError(e?.message || String(e));
      setStatus("");
    } finally {
      setIsBusy(false);
    }
  };

  const onDeleteCurrentPreview = () => {
    if (!previewCurrent) return;
    safeRevokeObjectUrl(previewCurrent.blobUrl);
    setPreviewImageList((list) =>
      list.filter((it) => it.id !== previewCurrent.id),
    );
  };

  const onClearPreview = () => {
    for (const it of previewImageList) safeRevokeObjectUrl(it.blobUrl);
    setPreviewImageList([]);
    setPreviewIndex(0);
    setShowingPreview(false);
  };

  const onSendToPS = async (mode) => {
    setError("");
    if (!previewCurrent) return;
    setIsBusy(true);
    try {
      setStatus(mode === "selection" ? "贴回选区..." : "贴回原位置...");
      const targetBounds =
        mode === "selection"
          ? getSelectionBounds()
          : previewCurrent.boundsAtStart;
      await placeImageUrlAtBounds(previewCurrent.url, targetBounds);
      setStatus("完成");
    } catch (e) {
      setError(e?.message || String(e));
      setStatus("");
    } finally {
      setIsBusy(false);
    }
  };

  const onSaveCurrent = async () => {
    setError("");
    if (!previewCurrent) return;
    setIsBusy(true);
    try {
      setStatus("保存中...");
      const res = await downloadAndSaveImage(previewCurrent.url);
      if (!res?.saved && res?.reason === "canceled") {
        setStatus("已取消");
        return;
      }
      setStatus("完成");
    } catch (e) {
      setError(e?.message || String(e));
      setStatus("");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={panelRoot}>
      <div className={tabList} role="tablist" aria-label="Main tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={tabBase + " " + (isActive ? tabActive : tabInactive)}
              onClick={() => setActiveTab(tab.id)}
              disabled={isBusy}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "home" ? (
        <div className={card}>
          <div className="flex items-center justify-between gap-2">
            <div className={cardTitle}>{showingPreview ? "预览" : "AI 图像编辑"}</div>
            <div className={cardMeta}>
              {showingPreview
                ? `共 ${previewImageList.length} 张`
                : `${getProviderLabel(activeProvider)} · 选区 → 生成 → 预览/贴回`}
            </div>
          </div>

          {showingPreview ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>预览区域</div>
                {previewCurrent ? (
                  <div className="w-full rounded-md border border-[color:var(--aya-border)] overflow-hidden bg-[color:var(--aya-preview-bg)] p-2">
                    <img
                      alt="preview"
                      src={previewCurrent.blobUrl || previewCurrent.url}
                      className="w-full h-48 object-contain"
                    />
                  </div>
                ) : (
                  <div className={helperText}>预览列表为空</div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>浏览</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setShowingPreview(false)}
                    disabled={isBusy}
                  >
                    返回编辑
                  </button>
                  <button
                    type="button"
                    className={btnBase}
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={isBusy || previewImageList.length <= 1}
                  >
                    上一张
                  </button>
                  <button
                    type="button"
                    className={btnBase}
                    onClick={() =>
                      setPreviewIndex((i) =>
                        Math.min(previewImageList.length - 1, i + 1),
                      )
                    }
                    disabled={isBusy || previewImageList.length <= 1}
                  >
                    下一张
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>输出</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => onSendToPS("original")}
                    disabled={isBusy || !previewCurrent}
                  >
                    Send to PS（原位置）
                  </button>
                  <button
                    type="button"
                    className={btnBase}
                    onClick={() => onSendToPS("selection")}
                    disabled={isBusy || !previewCurrent}
                  >
                    Send to PS（选区）
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>管理</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={btnBase}
                    onClick={onSaveCurrent}
                    disabled={isBusy || !previewCurrent}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className={btnBase}
                    onClick={onDeleteCurrentPreview}
                    disabled={isBusy || !previewCurrent}
                  >
                    删除
                  </button>
                  <button
                    type="button"
                    className={btnBase}
                    onClick={onClearPreview}
                    disabled={isBusy || !previewImageList.length}
                  >
                    清空
                  </button>
                </div>
              </div>

              {previewCurrent ? (
                <div className={helperText + " break-words"}>
                  {typeof previewCurrent.url === "string" &&
                  previewCurrent.url.startsWith("data:")
                    ? `${previewCurrent.url.slice(0, 80)}...`
                    : previewCurrent.url}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>输入</div>
                <div className={helperText}>
                  先选中 PS 里的目标区域，再输入提示词生成结果。
                </div>
                <div className="flex flex-col gap-1">
                  <span className={labelText}>提示词</span>
                  <textarea
                    className={textareaBase + " aya-prompt-textarea"}
                    rows={6}
                    placeholder="输入提示词，例如：把自行车改成红色..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <ProviderAdvancedOptions
                  settings={settings}
                  setSettings={setSettings}
                  isBusy={isBusy}
                  isDashscopeProvider={isDashscopeProvider}
                />
                <label className="flex flex-col gap-1">
                  <span className={labelText}>自动发送到 PS</span>
                  <select
                    className={fieldBase}
                    value={settings.autoSendMode || "off"}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSettings((s) => ({ ...s, autoSendMode: value }));
                    }}
                    disabled={isBusy}
                  >
                    <option value="off">关闭</option>
                    <option value="original">原位置</option>
                    <option value="selection">选区</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <div className={sectionTitle}>动作</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={onGenerate}
                    disabled={isBusy}
                  >
                    {isBusy ? "处理中..." : "生成"}
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => setShowingPreview(true)}
                    disabled={isBusy || !previewImageList.length}
                  >
                    显示预览({previewImageList.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={card}>
          <div className={cardTitle}>设置</div>

          <div className={helperText}>设置会自动保存</div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelText}>Provider</span>
              <select
                className={fieldBase}
                value={activeProvider}
                onChange={(e) => {
                  const value = e.target.value;
                  setSettings((s) => ({ ...s, provider: normalizeProvider(value) }));
                }}
                disabled={isBusy}
              >
                <option value={PROVIDER_DASHSCOPE}>DashScope</option>
                <option value={PROVIDER_GEMINI}>Gemini Banana</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={labelText}>
                {isGeminiProvider ? "Gemini API Key" : "DashScope API Key"}
              </span>
              <input
                className={fieldBase}
                type="password"
                value={isGeminiProvider ? settings.geminiApiKey : settings.apiKey}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isGeminiProvider) {
                    setSettings((s) => ({ ...s, geminiApiKey: value }));
                    return;
                  }
                  setSettings((s) => ({ ...s, apiKey: value }));
                }}
                disabled={isBusy}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={labelText}>模型</span>
              {isGeminiProvider ? (
                <select
                  className={fieldBase}
                  value={settings.geminiModel}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettings((s) => ({ ...s, geminiModel: value }));
                  }}
                  disabled={isBusy}
                >
                  {GEMINI_MODEL_OPTIONS.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={fieldBase}
                  type="text"
                  value={settings.model}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSettings((s) => ({ ...s, model: value }));
                  }}
                  disabled={isBusy}
                />
              )}
            </label>

            <ProviderAdvancedOptions
              settings={settings}
              setSettings={setSettings}
              isBusy={isBusy}
              isDashscopeProvider={isDashscopeProvider}
              compact
            />
          </div>
        </div>
      )}

      {(status || error) ? (
        <div className={feedbackStack}>
          {status ? <div className={statusBox}>{status}</div> : null}
          {error ? <div className={errorBox}>{error}</div> : null}
        </div>
      ) : null}
    </div>
  );
};

export const MainPanel = () => (
  <PanelErrorBoundary>
    <MainPanelInner />
  </PanelErrorBoundary>
);
