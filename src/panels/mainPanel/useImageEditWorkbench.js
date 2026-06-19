import { useEffect, useMemo, useRef, useState } from "react";

import {
  generateImageByProvider,
  getProviderApiKey,
  getProviderLabel,
  normalizeProvider,
  PROVIDER_DASHSCOPE,
  PROVIDER_GEMINI,
  PROVIDER_OPENAI,
} from "./aiProvider.js";
import { placeImageUrlAtBounds } from "./placeImage.js";
import {
  canvasToImageBase64,
  getSelectionBounds,
  layerToImageBase64,
} from "./psSelection.js";
import { defaultSettings } from "./sharedSettings.js";
import { readSettingsFromDisk, writeSettingsToDisk } from "./settingsStorage.js";
import {
  runAddNeutralGrayLayerInHost,
  runRemoveBlemishRetouchInHost,
  runSetSoftWhiteBrushInHost,
  saveGeneratedImageToHost,
  subscribePhotoshopDocumentChange,
} from "../../bridge/hostBridge.js";

function createPreviewItem(url, boundsAtStart, docId, batchKey, index) {
  return {
    id: `${batchKey}-${index}`,
    url,
    docId,
    boundsAtStart,
  };
}

function createUploadId() {
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取图片文件失败。"));
    reader.readAsDataURL(file);
  });
}

function splitImageDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) {
    throw new Error("图片文件数据无效。");
  }

  const meta = dataUrl.slice(5, commaIndex);
  const mime = meta.split(";")[0] || "image/png";
  return {
    base64: dataUrl.slice(commaIndex + 1),
    mime,
  };
}

async function fileToUploadedImage(file) {
  if (!file || !/^image\//i.test(file.type || "")) {
    throw new Error("请选择图片文件。");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const payload = splitImageDataUrl(dataUrl);
  return {
    id: createUploadId(),
    name: file.name || "image",
    size: Number.isFinite(file.size) ? file.size : 0,
    mime: payload.mime,
    base64: payload.base64,
    dataUrl,
    source: "file",
  };
}

function capturedPayloadToUploadedImage(payload, source) {
  const name = source === "layer" ? "当前图层" : "当前画布";
  return {
    id: createUploadId(),
    name,
    size: 0,
    mime: payload.mime,
    base64: payload.base64,
    dataUrl: `data:${payload.mime};base64,${payload.base64}`,
    bounds: payload.bounds || null,
    docId: payload.docId || null,
    source,
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
  const [uploadedInputImage, setUploadedInputImage] = useState(null);
  const [uploadedReferenceImages, setUploadedReferenceImages] = useState([]);
  const [generationMode, setGenerationMode] = useState("image");
  const [autoRefreshInput, setAutoRefreshInput] = useState(true);
  const settingsSaveTimerRef = useRef(null);
  const inputRefreshInFlightRef = useRef(false);
  const lastInputRefreshAtRef = useRef(0);
  const uploadedInputImageRef = useRef(null);
  const documentChangeRefreshTimerRef = useRef(null);

  const activeProvider = normalizeProvider(settings.provider);
  const providerLabel = getProviderLabel(activeProvider);
  const isGeminiProvider = activeProvider === PROVIDER_GEMINI;
  const isDashscopeProvider = activeProvider === PROVIDER_DASHSCOPE;
  const isOpenAIProvider = activeProvider === PROVIDER_OPENAI;

  const selectedPreview = useMemo(
    () => previewItems.find((item) => item.id === selectedPreviewId) || null,
    [previewItems, selectedPreviewId]
  );

  const selectedPreviewIndex = useMemo(
    () => previewItems.findIndex((item) => item.id === selectedPreviewId),
    [previewItems, selectedPreviewId]
  );

  useEffect(() => {
    uploadedInputImageRef.current = uploadedInputImage;
  }, [uploadedInputImage]);

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

  const onUploadInputImage = async (files) => {
    clearFeedback();
    const file = files?.[0];
    if (!file) {
      return;
    }

    try {
      const image = await fileToUploadedImage(file);
      setUploadedInputImage(image);
      setAutoRefreshInput(false);
      setStatus("待修改照片已载入。");
    } catch (cause) {
      setError(cause?.message || String(cause));
    }
  };

  const captureInputFromHost = async (source, options = {}) => {
    const silent = Boolean(options.silent);
    const force = Boolean(options.force);
    const now = Date.now();
    if (silent && !force && now - lastInputRefreshAtRef.current < 180) {
      return uploadedInputImageRef.current;
    }
    if (inputRefreshInFlightRef.current) {
      return uploadedInputImageRef.current;
    }

    inputRefreshInFlightRef.current = true;
    if (!silent) {
      clearFeedback();
      setIsBusy(true);
      setStatus(source === "layer" ? "正在读取当前图层..." : "正在读取当前画布...");
    }

    try {
      const payload = source === "layer" ? await layerToImageBase64() : await canvasToImageBase64();
      const image = capturedPayloadToUploadedImage(payload, source);
      const prev = uploadedInputImageRef.current;
      if (silent && prev && prev.base64 === image.base64) {
        return prev;
      }
      setUploadedInputImage(image);
      uploadedInputImageRef.current = image;
      if (!silent) {
        setGenerationMode("image");
        setAutoRefreshInput(true);
        setStatus(source === "layer" ? "当前图层已载入。" : "当前画布已载入。");
      }
      return image;
    } catch (cause) {
      if (!silent) {
        setStatus("");
        setError(cause?.message || String(cause));
      }
      throw cause;
    } finally {
      inputRefreshInFlightRef.current = false;
      if (!silent) {
        setIsBusy(false);
      }
    }
  };

  const onCaptureCanvasInputImage = () => captureInputFromHost("canvas");
  const onCaptureLayerInputImage = () => captureInputFromHost("layer");
  const onRefreshBoundInputImage = async (options = {}) => {
    if (!autoRefreshInput) {
      return;
    }

    const source = uploadedInputImageRef.current?.source;
    if (source !== "canvas" && source !== "layer") {
      return;
    }

    try {
      await captureInputFromHost(source, { silent: true, force: Boolean(options.force) });
    } catch {
      // Keep the existing preview interactive; explicit capture/generate will surface errors.
    }
  };

  const onToggleAutoRefreshInput = async () => {
    const source = uploadedInputImageRef.current?.source;
    const boundSource = source === "canvas" || source === "layer" ? source : "canvas";
    const nextAutoRefresh = source === "canvas" || source === "layer" ? !autoRefreshInput : true;

    setAutoRefreshInput(nextAutoRefresh);
    if (!nextAutoRefresh) {
      setStatus("自动获取已关闭。");
      return;
    }

    try {
      await captureInputFromHost(boundSource);
      setStatus("自动获取已开启。");
    } catch {
      setAutoRefreshInput(false);
      // captureInputFromHost already surfaces the error.
    }
  };

  const onClearUploadedInputImage = () => {
    clearFeedback();
    setUploadedInputImage(null);
    uploadedInputImageRef.current = null;
    setStatus("已移除待修改照片。");
  };

  const onUploadReferenceImages = async (files) => {
    clearFeedback();
    const fileList = Array.from(files || []);
    if (!fileList.length) {
      return;
    }

    try {
      const images = await Promise.all(fileList.map((file) => fileToUploadedImage(file)));
      setUploadedReferenceImages((current) => [...current, ...images]);
      setStatus(`已载入 ${images.length} 张参考图。`);
    } catch (cause) {
      setError(cause?.message || String(cause));
    }
  };

  const onRemoveReferenceImage = (imageId) => {
    clearFeedback();
    setUploadedReferenceImages((current) => current.filter((item) => item.id !== imageId));
    setStatus("参考图已移除。");
  };

  const onClearReferenceImages = () => {
    clearFeedback();
    setUploadedReferenceImages([]);
    setStatus("参考图已清空。");
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
      const isImageMode = generationMode !== "text";
      let capturedSelection = null;
      let mainInputImage = null;

      if (isImageMode) {
        const usingUploadedInput = Boolean(uploadedInputImage);
        setStatus(usingUploadedInput ? "正在准备图像输入..." : "正在读取当前画布...");
        if (usingUploadedInput) {
          const source = uploadedInputImage.source;
          const freshInput =
            autoRefreshInput && (source === "canvas" || source === "layer")
              ? await captureInputFromHost(source, { silent: true, force: true })
              : uploadedInputImage;
          mainInputImage = freshInput || uploadedInputImage;
          capturedSelection = mainInputImage.bounds
            ? { bounds: mainInputImage.bounds, docId: mainInputImage.docId }
            : null;
        } else {
          const capturedCanvas = await canvasToImageBase64();
          capturedSelection = {
            bounds: capturedCanvas.bounds,
            docId: capturedCanvas.docId,
          };
          mainInputImage = {
            id: "photoshop-canvas",
            name: "photoshop-canvas.png",
            mime: capturedCanvas.mime,
            base64: capturedCanvas.base64,
            bounds: capturedCanvas.bounds,
            docId: capturedCanvas.docId,
            source: "canvas",
          };
        }
      }

      const inputImages = mainInputImage
        ? [mainInputImage, ...uploadedReferenceImages]
        : [...uploadedReferenceImages];

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
        inputImageBase64: mainInputImage?.base64 || "",
        inputImageMime: mainInputImage?.mime || "image/png",
        inputImages,
        generationMode,
        dashscopeParameters,
      });

      if (!generated.urls.length) {
        throw new Error("服务端未返回图片结果。");
      }

      addGeneratedResults(generated.urls, capturedSelection?.bounds || null, capturedSelection?.docId || null);

      const autoSendMode = settings.autoSendMode || "off";
      if (autoSendMode !== "off") {
        if (autoSendMode === "original" && !capturedSelection?.bounds) {
          setStatus(`已生成 ${generated.urls.length} 张结果。上传照片没有原始位置，未自动回填。`);
          return;
        }

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

  useEffect(() => {
    const source = uploadedInputImage?.source;
    if (!autoRefreshInput || (source !== "canvas" && source !== "layer")) {
      return undefined;
    }

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      onRefreshBoundInputImage({ force: true });
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [autoRefreshInput, uploadedInputImage?.source]);

  useEffect(() => {
    const source = uploadedInputImage?.source;
    if (!autoRefreshInput || (source !== "canvas" && source !== "layer") || isBusy) {
      return undefined;
    }

    const timer = setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      onRefreshBoundInputImage();
    }, 3000);

    return () => {
      clearInterval(timer);
    };
  }, [autoRefreshInput, isBusy, uploadedInputImage?.source]);

  useEffect(() => {
    const source = uploadedInputImage?.source;
    if (!autoRefreshInput || (source !== "canvas" && source !== "layer") || isBusy) {
      return undefined;
    }

    const unsubscribe = subscribePhotoshopDocumentChange(() => {
      if (document.visibilityState === "hidden") {
        return;
      }

      if (documentChangeRefreshTimerRef.current) {
        clearTimeout(documentChangeRefreshTimerRef.current);
      }

      documentChangeRefreshTimerRef.current = setTimeout(() => {
        documentChangeRefreshTimerRef.current = null;
        onRefreshBoundInputImage({ force: true });
      }, 90);
    });

    return () => {
      unsubscribe();
      if (documentChangeRefreshTimerRef.current) {
        clearTimeout(documentChangeRefreshTimerRef.current);
        documentChangeRefreshTimerRef.current = null;
      }
    };
  }, [autoRefreshInput, isBusy, uploadedInputImage?.source]);

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

      if (!targetBounds) {
        throw new Error("该结果没有原始位置，请发送到当前选区。");
      }

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
    isOpenAIProvider,
    generationMode,
    autoRefreshInput,
    onCaptureCanvasInputImage,
    onCaptureLayerInputImage,
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
    uploadedInputImage,
    uploadedReferenceImages,
    onClearReferenceImages,
    onClearUploadedInputImage,
    onRemoveReferenceImage,
    onUploadInputImage,
    onUploadReferenceImages,
    onRefreshBoundInputImage,
    setGenerationMode,
    onToggleAutoRefreshInput,
  };
}
