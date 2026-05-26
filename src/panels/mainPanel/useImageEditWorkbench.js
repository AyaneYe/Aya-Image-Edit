import { useEffect, useMemo, useRef, useState } from "react";

import {
  generateImageByProvider,
  getProviderApiKey,
  getProviderLabel,
  normalizeProvider,
  PROVIDER_DASHSCOPE,
  PROVIDER_GEMINI,
} from "./aiProvider.js";
import { placeImageUrlAtBounds } from "./placeImage.js";
import { getSelectionBounds, selectionToImageBase64 } from "./psSelection.js";
import { defaultSettings } from "./sharedSettings.js";
import { readSettingsFromDisk, writeSettingsToDisk } from "./settingsStorage.js";
import {
  runAddNeutralGrayLayerInHost,
  runRemoveBlemishRetouchInHost,
  runSetSoftWhiteBrushInHost,
  saveGeneratedImageToHost,
} from "../../bridge/hostBridge.js";

function createPreviewItem(url, boundsAtStart, docId, batchKey, index) {
  return {
    id: `${batchKey}-${index}`,
    url,
    docId,
    boundsAtStart,
  };
}

export function useImageEditWorkbench() {
  const [activeView, setActiveView] = useState("workbench");
  const [settings, setSettings] = useState(defaultSettings);
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [previewItems, setPreviewItems] = useState([]);
  const [selectedPreviewId, setSelectedPreviewId] = useState(null);
  const settingsSaveTimerRef = useRef(null);

  const activeProvider = normalizeProvider(settings.provider);
  const providerLabel = getProviderLabel(activeProvider);
  const isGeminiProvider = activeProvider === PROVIDER_GEMINI;
  const isDashscopeProvider = activeProvider === PROVIDER_DASHSCOPE;

  const selectedPreview = useMemo(
    () => previewItems.find((item) => item.id === selectedPreviewId) || null,
    [previewItems, selectedPreviewId]
  );

  const selectedPreviewIndex = useMemo(
    () => previewItems.findIndex((item) => item.id === selectedPreviewId),
    [previewItems, selectedPreviewId]
  );

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const loadedSettings = await readSettingsFromDisk();
      if (!isMounted) {
        return;
      }

      setSettings(loadedSettings);
      setPrompt(typeof loadedSettings.lastPrompt === "string" ? loadedSettings.lastPrompt : "");
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = setTimeout(() => {
      writeSettingsToDisk({
        ...settings,
        lastPrompt: prompt,
      });
    }, 300);

    return () => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
        settingsSaveTimerRef.current = null;
      }
    };
  }, [settings, prompt]);

  useEffect(() => {
    if (!previewItems.length) {
      if (selectedPreviewId !== null) {
        setSelectedPreviewId(null);
      }
      return;
    }

    const stillExists = previewItems.some((item) => item.id === selectedPreviewId);
    if (!stillExists) {
      setSelectedPreviewId(previewItems[0].id);
    }
  }, [previewItems, selectedPreviewId]);

  const clearFeedback = () => {
    setStatus("");
    setError("");
  };

  const addGeneratedResults = (urls, boundsAtStart, docId) => {
    const batchKey = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newItems = urls.map((url, index) =>
      createPreviewItem(url, boundsAtStart, docId, batchKey, index)
    );
    setPreviewItems((currentItems) => [...newItems, ...currentItems]);
    if (newItems.length) {
      setSelectedPreviewId(newItems[0].id);
    }
  };

  const onGenerate = async () => {
    clearFeedback();

    const providerApiKey = getProviderApiKey(settings, activeProvider);
    if (!providerApiKey) {
      setError(`请先在设置中填写 ${providerLabel} 密钥。`);
      return;
    }

    if (!prompt.trim()) {
      setError("请先输入提示词。");
      return;
    }

    setIsBusy(true);
    try {
      setStatus("正在读取 Photoshop 选区...");
      const capturedSelection = await selectionToImageBase64();

      const cleanedNegativePrompt =
        typeof settings.negative_prompt === "string"
          ? settings.negative_prompt.trim()
          : "";
      const cleanedSize = typeof settings.size === "string" ? settings.size.trim() : "";

      const dashscopeParameters = isDashscopeProvider
        ? {
            n: 1,
            negative_prompt: cleanedNegativePrompt.length ? cleanedNegativePrompt : " ",
            prompt_extend: Boolean(settings.prompt_extend),
            watermark: Boolean(settings.watermark),
            ...(cleanedSize.length ? { size: cleanedSize } : null),
          }
        : null;

      setStatus(`正在使用 ${providerLabel} 生成...`);
      const generated = await generateImageByProvider({
        settings,
        prompt,
        inputImageBase64: capturedSelection.base64,
        inputImageMime: capturedSelection.mime,
        dashscopeParameters,
      });

      if (!generated.urls.length) {
        throw new Error("服务端未返回图片结果。");
      }

      addGeneratedResults(generated.urls, capturedSelection.bounds, capturedSelection.docId);

      const autoSendMode = settings.autoSendMode || "off";
      if (autoSendMode !== "off") {
        setStatus(
          autoSendMode === "selection"
            ? "正在把第一张结果发送到当前选区..."
            : "正在把第一张结果发送到原始位置..."
        );

        const targetBounds =
          autoSendMode === "selection"
            ? await getSelectionBounds()
            : capturedSelection.bounds;
        await placeImageUrlAtBounds(generated.urls[0], targetBounds);
        setStatus("第一张结果已发送到 Photoshop。");
      } else {
        setStatus(`已生成 ${generated.urls.length} 张结果。`);
      }
    } catch (cause) {
      setStatus("");
      setError(cause?.message || String(cause));
    } finally {
      setIsBusy(false);
    }
  };

  const runRetouchShortcut = async (options) => {
    clearFeedback();

    setIsBusy(true);
    try {
      setStatus(options.runningStatus);
      await options.run();
      setStatus(options.successStatus);
    } catch (cause) {
      setStatus("");
      setError(cause?.message || String(cause));
    } finally {
      setIsBusy(false);
    }
  };

  const onRunRemoveBlemishRetouch = async () =>
    runRetouchShortcut({
      runningStatus: "正在复制图层并打开蒙尘与划痕...",
      successStatus: "去除瑕疵图层已创建，并已添加黑色蒙版。",
      run: () => runRemoveBlemishRetouchInHost(),
    });

  const onRunAddNeutralGrayLayer = async () =>
    runRetouchShortcut({
      runningStatus: "正在添加中性灰层...",
      successStatus: "中性灰层已添加。",
      run: () => runAddNeutralGrayLayerInHost(),
    });

  const onRunSetSoftWhiteBrush = async () =>
    runRetouchShortcut({
      runningStatus: "正在切换到瑕疵笔刷...",
      successStatus: "画笔已切换为白色软圆笔刷。",
      run: () => runSetSoftWhiteBrushInHost(),
    });

  const onSendSelectedPreview = async (mode) => {
    clearFeedback();

    if (!selectedPreview) {
      setError("请先选择一张结果。");
      return;
    }

    setIsBusy(true);
    try {
      setStatus(
        mode === "selection"
          ? "正在发送到当前选区..."
          : "正在发送到原始位置..."
      );

      const targetBounds =
        mode === "selection"
          ? await getSelectionBounds()
          : selectedPreview.boundsAtStart;

      await placeImageUrlAtBounds(selectedPreview.url, targetBounds);
      setStatus("已发送到 Photoshop。");
    } catch (cause) {
      setStatus("");
      setError(cause?.message || String(cause));
    } finally {
      setIsBusy(false);
    }
  };

  const onSaveSelectedPreview = async () => {
    clearFeedback();

    if (!selectedPreview) {
      setError("请先选择要保存的结果。");
      return;
    }

    setIsBusy(true);
    try {
      setStatus("正在保存结果...");
      const outcome = await saveGeneratedImageToHost(selectedPreview.url);
      if (!outcome?.saved && outcome?.reason === "canceled") {
        setStatus("已取消保存。");
        return;
      }
      setStatus("结果已保存。");
    } catch (cause) {
      setStatus("");
      setError(cause?.message || String(cause));
    } finally {
      setIsBusy(false);
    }
  };

  const onDeleteSelectedPreview = () => {
    clearFeedback();

    if (!selectedPreview) {
      setError("请先选择要删除的结果。");
      return;
    }

    setPreviewItems((currentItems) =>
      currentItems.filter((item) => item.id !== selectedPreview.id)
    );
    setStatus("结果已删除。");
  };

  const onClearPreviews = () => {
    clearFeedback();
    setPreviewItems([]);
    setSelectedPreviewId(null);
    setStatus("结果区已清空。");
  };

  const onSelectPrevious = () => {
    if (selectedPreviewIndex <= 0) {
      return;
    }
    setSelectedPreviewId(previewItems[selectedPreviewIndex - 1].id);
  };

  const onSelectNext = () => {
    if (selectedPreviewIndex < 0 || selectedPreviewIndex >= previewItems.length - 1) {
      return;
    }
    setSelectedPreviewId(previewItems[selectedPreviewIndex + 1].id);
  };

  return {
    activeProvider,
    activeView,
    canGoNext: selectedPreviewIndex >= 0 && selectedPreviewIndex < previewItems.length - 1,
    canGoPrevious: selectedPreviewIndex > 0,
    error,
    isBusy,
    isDashscopeProvider,
    isGeminiProvider,
    onClearPreviews,
    onDeleteSelectedPreview,
    onGenerate,
    onRunAddNeutralGrayLayer,
    onRunRemoveBlemishRetouch,
    onRunSetSoftWhiteBrush,
    onOpenSettings: () => {
      if (!isBusy) {
        setActiveView("settings");
      }
    },
    onOpenWorkbench: () => {
      if (!isBusy) {
        setActiveView("workbench");
      }
    },
    onSaveSelectedPreview,
    onSelectNext,
    onSelectPrevious,
    onSelectPreview: setSelectedPreviewId,
    onSendSelectedPreview,
    previewCount: previewItems.length,
    previewItems,
    prompt,
    providerLabel,
    selectedPreview,
    selectedPreviewId,
    selectedPreviewIndex,
    setPrompt,
    setSettings,
    settings,
    status,
  };
}
