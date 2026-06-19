import React from "react";
import { ChevronDown, ImageOff, ImagePlus, Play, Plus, Settings2, SlidersHorizontal, Zap } from "lucide-react";

import { ResultWorkspace } from "./ResultWorkspace.jsx";

import "./ImageEditWorkbench.css";

const FIELD_CLASS = "fieldset";
const LABEL_CLASS = "fieldset-legend";
const INPUT_CLASS = "input input-sm w-full";
const SELECT_CLASS = "select select-sm w-full";
const PANEL_ICON_SIZE = 16;

const getAutoSendLabel = (mode) => {
  if (mode === "selection") {
    return "当前选区";
  }

  if (mode === "original") {
    return "原始位置";
  }

  return "关闭";
};

const CollapseChevron = ({ collapsed }) => (
  <ChevronDown
    size={16}
    strokeWidth={2}
    className={"aya-panel-chevron" + (collapsed ? " aya-panel-chevron--collapsed" : "")}
    aria-hidden="true"
  />
);

const ToolPanelHeader = ({ icon: Icon, title, collapsed, onToggleCollapse, trailing }) => (
  <button
    type="button"
    className={"aya-tool-panel__header" + (collapsed ? " aya-tool-panel__header--collapsed" : "")}
    onClick={onToggleCollapse}
    aria-expanded={!collapsed}
  >
    <span className="aya-tool-panel__title-wrap">
      {Icon ? (
        <span className="aya-tool-panel__icon">
          <Icon size={PANEL_ICON_SIZE} strokeWidth={1.8} />
        </span>
      ) : null}
      <span className="aya-tool-panel__title">{title}</span>
    </span>
    <span className="aya-tool-panel__right">
      {trailing}
      <CollapseChevron collapsed={collapsed} />
    </span>
  </button>
);

const ShortcutCard = ({
  collapsed,
  isBusy,
  onToggleCollapse,
  onRunAddNeutralGrayLayer,
  onRunRemoveBlemishRetouch,
  onRunSetSoftWhiteBrush,
}) => (
  <section className="aya-tool-panel">
    <ToolPanelHeader
      icon={Zap}
      title="快捷工具"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />

    <div className={"aya-collapse-body" + (collapsed ? " aya-collapse-body--collapsed" : "")}>
      <div className="aya-collapse-body__inner">
        <div className="aya-tool-panel__body">
          <div className="aya-retouch-shortcuts__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm normal-case aya-shortcut-button"
              onClick={onRunRemoveBlemishRetouch}
              disabled={isBusy}
            >
              去除瑕疵
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm normal-case aya-shortcut-button"
              onClick={onRunAddNeutralGrayLayer}
              disabled={isBusy}
            >
              添加中性灰层
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm normal-case aya-shortcut-button"
              onClick={onRunSetSoftWhiteBrush}
              disabled={isBusy}
            >
              瑕疵笔刷
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const UploadCard = ({
  autoRefreshInput,
  collapsed,
  generationMode,
  isBusy,
  onCaptureCanvasInputImage,
  onCaptureLayerInputImage,
  onClearReferenceImages,
  onClearUploadedInputImage,
  onRemoveReferenceImage,
  onRefreshBoundInputImage,
  onToggleAutoRefreshInput,
  onToggleCollapse,
  onUploadInputImage,
  onUploadReferenceImages,
  setGenerationMode,
  uploadedInputImage,
  uploadedReferenceImages,
}) => {
  const isTextMode = generationMode === "text";
  const mainDisabled = isBusy || isTextMode;
  const inputSource = uploadedInputImage?.source || "";
  const isBoundInputSource = inputSource === "canvas" || inputSource === "layer";
  const isAutoRefreshActive = autoRefreshInput && isBoundInputSource;
  const sourceLabel =
    inputSource === "canvas"
      ? "画布"
      : inputSource === "layer"
        ? "图层"
        : inputSource === "file"
          ? "文件"
          : "未绑定";
  const autoButtonTitle = isAutoRefreshActive
    ? `自动获取已开启：${sourceLabel}`
    : inputSource === "file"
      ? "文件输入是固定快照，点击后改为当前画布并开启自动获取"
      : "自动获取已关闭，点击后绑定当前画布并开启";

  return (
  <section className="aya-tool-panel aya-upload-panel">
    <ToolPanelHeader
      icon={ImagePlus}
      title="图像上传"
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />

    <div className={"aya-collapse-body" + (collapsed ? " aya-collapse-body--collapsed" : "")}>
    <div className="aya-collapse-body__inner">
    <div className="aya-upload-panel__body">
      <div
        className="aya-upload-main-slot"
        onMouseEnter={() => onRefreshBoundInputImage({ force: true })}
      >
        <div className="aya-upload-toolbar">
          <div className="aya-upload-mode-toggle join">
            <button
              type="button"
              className={
                "aya-upload-mode-button join-item" +
                (generationMode !== "text" ? " aya-upload-mode-button--active" : "")
              }
              aria-pressed={generationMode !== "text"}
              onClick={() => setGenerationMode("image")}
              disabled={isBusy}
            >
              图生图
            </button>
            <button
              type="button"
              className={
                "aya-upload-mode-button join-item" +
                (generationMode === "text" ? " aya-upload-mode-button--active" : "")
              }
              aria-pressed={generationMode === "text"}
              onClick={() => setGenerationMode("text")}
              disabled={isBusy}
            >
              文生图
            </button>
          </div>
          <button
            type="button"
            className={
              "aya-upload-auto-toggle" +
              (isAutoRefreshActive
                ? " aya-upload-auto-toggle--active"
                : " aya-upload-auto-toggle--inactive")
            }
            aria-pressed={isAutoRefreshActive}
            title={autoButtonTitle}
            onClick={onToggleAutoRefreshInput}
            disabled={mainDisabled}
          >
            {isAutoRefreshActive ? "自动获取:开" : "自动获取:关"}
          </button>
        </div>

        <label
          className={
            "aya-upload-dropzone aya-upload-dropzone--main" +
            (isTextMode ? " aya-upload-dropzone--disabled" : "")
          }
        >
          <span className="aya-upload-slot__label">图1</span>
          {isTextMode ? (
            <span className="aya-upload-dropzone__hint">
              <ImageOff size={20} strokeWidth={1.8} />
              文生图模式无需输入图
            </span>
          ) : uploadedInputImage ? (
            <>
              <img
                className="aya-upload-dropzone__image"
                src={uploadedInputImage.dataUrl}
                alt={uploadedInputImage.name}
              />
              <button
                type="button"
                className="btn btn-error btn-xs aya-upload-dropzone__remove"
                onClick={(event) => {
                  event.preventDefault();
                  onClearUploadedInputImage();
                }}
                disabled={isBusy}
              >
                移除
              </button>
            </>
          ) : (
            <span className="aya-upload-dropzone__empty">
              <Plus size={18} strokeWidth={2.4} />
              点击选择文件
            </span>
          )}

          <input
            id="aya-upload-input-file"
            className="aya-upload-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              onUploadInputImage(event.target.files);
              event.target.value = "";
            }}
            disabled={mainDisabled}
          />
        </label>

        <div className="aya-upload-source-row join">
          <button
            type="button"
            className={
              "aya-upload-source-button join-item" +
              (inputSource === "canvas" ? " aya-upload-source-button--active" : "")
            }
            onClick={onCaptureCanvasInputImage}
            disabled={mainDisabled}
          >
            画布
          </button>
          <button
            type="button"
            className={
              "aya-upload-source-button join-item" +
              (inputSource === "layer" ? " aya-upload-source-button--active" : "")
            }
            onClick={onCaptureLayerInputImage}
            disabled={mainDisabled}
          >
            图层
          </button>
          <label
            className={
              "aya-upload-source-button join-item" +
              (inputSource === "file" ? " aya-upload-source-button--active" : "") +
              (mainDisabled ? " aya-upload-source-button--disabled" : "")
            }
            htmlFor="aya-upload-input-file"
          >
            文件
          </label>
        </div>
      </div>

      <div className="aya-upload-reference-slot">
        <div className="aya-upload-slot__label aya-upload-slot__label--right">参考图</div>
        <div className="aya-reference-scroll">
          <label className="aya-upload-dropzone aya-upload-dropzone--reference">
            <Plus size={26} strokeWidth={2.6} />
            <input
              className="aya-upload-file-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                onUploadReferenceImages(event.target.files);
                event.target.value = "";
              }}
              disabled={isBusy}
            />
          </label>

          {uploadedReferenceImages.map((image) => (
            <div key={image.id} className="aya-reference-thumb">
              <img className="aya-reference-thumb__image" src={image.dataUrl} alt={image.name} />
              <button
                type="button"
                className="btn btn-circle btn-error btn-xs aya-reference-thumb__remove"
                onClick={() => onRemoveReferenceImage(image.id)}
                disabled={isBusy}
                aria-label={`移除 ${image.name}`}
              >
                x
              </button>
            </div>
          ))}
        </div>

        {uploadedReferenceImages.length ? (
          <button
            type="button"
            className="btn btn-ghost btn-xs aya-upload-clear-refs"
            onClick={onClearReferenceImages}
            disabled={isBusy}
          >
            清空
          </button>
        ) : null}
      </div>
    </div>
    </div>
    </div>
  </section>
  );
};

const ParameterCard = ({
  collapsed,
  isBusy,
  isDashscopeProvider,
  isGeminiProvider,
  onToggleCollapse,
  prompt,
  setPrompt,
  setSettings,
  settings,
}) => {
  const autoSendMode = settings.autoSendMode || "off";

  return (
    <section className="aya-tool-panel">
      <ToolPanelHeader
        icon={SlidersHorizontal}
        title="编辑参数"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />

        <div className={"aya-collapse-body" + (collapsed ? " aya-collapse-body--collapsed" : "")}>
        <div className="aya-collapse-body__inner">
        <div className="aya-tool-panel__body">
        <label className={FIELD_CLASS}>
          <span className={LABEL_CLASS}>提示词</span>
          <textarea
            className="textarea w-full"
            rows={7}
            placeholder="描述要如何修改当前选区"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={isBusy}
          />
        </label>

        <label className="aya-toggle-line">
          <input
            className="toggle toggle-primary toggle-sm"
            type="checkbox"
            checked={autoSendMode !== "off"}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                autoSendMode: event.target.checked
                  ? current.autoSendMode === "original"
                    ? "original"
                    : "selection"
                  : "off",
              }))
            }
            disabled={isBusy}
          />
          <span className="text-sm font-medium">自动回填</span>
          <span className="text-xs text-base-content/50">{getAutoSendLabel(autoSendMode)}</span>
        </label>

        {isDashscopeProvider ? (
          <>
            <div className="aya-field-grid">
              <label className={FIELD_CLASS}>
                <span className={LABEL_CLASS}>输出尺寸</span>
                <input
                  className={INPUT_CLASS}
                  type="text"
                  value={settings.size}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, size: event.target.value }))
                  }
                  disabled={isBusy}
                  placeholder="1536*1024"
                />
              </label>
              <label className={FIELD_CLASS}>
                <span className={LABEL_CLASS}>反向提示词</span>
                <input
                  className={INPUT_CLASS}
                  type="text"
                  value={settings.negative_prompt}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      negative_prompt: event.target.value,
                    }))
                  }
                  disabled={isBusy}
                />
              </label>
            </div>

            <div className="aya-inline-toggle-row">
              <label className="aya-toggle-line">
                <input
                  className="toggle toggle-primary toggle-sm"
                  type="checkbox"
                  checked={Boolean(settings.prompt_extend)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      prompt_extend: event.target.checked,
                    }))
                  }
                  disabled={isBusy}
                />
                <span className="text-sm">启用提示词扩写</span>
              </label>

              <label className="aya-toggle-line">
                <input
                  className="toggle toggle-primary toggle-sm"
                  type="checkbox"
                  checked={Boolean(settings.watermark)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      watermark: event.target.checked,
                    }))
                  }
                  disabled={isBusy}
                />
                <span className="text-sm">添加水印</span>
              </label>
            </div>
          </>
        ) : isGeminiProvider ? (
          <div className="aya-field-grid">
            <label className={FIELD_CLASS}>
              <span className={LABEL_CLASS}>宽高比</span>
              <select
                className={SELECT_CLASS}
                value={settings.geminiAspectRatio || ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    geminiAspectRatio: event.target.value,
                  }))
                }
                disabled={isBusy}
              >
                <option value="">默认</option>
                <option value="1:1">1:1</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="4:5">4:5</option>
                <option value="5:4">5:4</option>
                <option value="9:16">9:16</option>
                <option value="16:9">16:9</option>
                <option value="21:9">21:9</option>
              </select>
            </label>
            <label className={FIELD_CLASS}>
              <span className={LABEL_CLASS}>图像尺寸</span>
              <select
                className={SELECT_CLASS}
                value={settings.geminiImageSize || ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    geminiImageSize: event.target.value,
                  }))
                }
                disabled={isBusy}
              >
                <option value="">默认（1K）</option>
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
          </div>
        ) : null}
        </div>
        </div>
        </div>
    </section>
  );
};

const OperationCard = ({
  collapsed,
  error,
  generationMode,
  isBusy,
  onGenerate,
  onToggleCollapse,
  previewCount,
  providerLabel,
  settings,
  status,
  uploadedInputImage,
  uploadedReferenceImages,
}) => {
  const imageCount =
    generationMode === "text"
      ? uploadedReferenceImages.length
      : (uploadedInputImage ? 1 : 1) + uploadedReferenceImages.length;
  const sizeContext =
    settings.size ||
    settings.geminiImageSize ||
    "auto";
  const modelContext =
    settings.provider === "openai"
      ? settings.openaiModel
      : settings.provider === "gemini"
        ? settings.geminiModel
        : settings.model;
  const operationLine = error
    ? "任务需要处理..."
    : isBusy
      ? "任务执行中..."
      : status || "空闲 ~";
  const contextLine = `信息：${providerLabel} | ${sizeContext || "auto"} | ${modelContext || "auto"} | ${imageCount}张`;

  return (
    <section className="aya-tool-panel aya-operation-panel">
      <ToolPanelHeader
        icon={Settings2}
        title="操作台"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />

      <div className={"aya-collapse-body" + (collapsed ? " aya-collapse-body--collapsed" : "")}>
      <div className="aya-collapse-body__inner">
      <div className="aya-operation-panel__body">
        <div
          className={
            "aya-operation-readout" +
            (error
              ? " aya-operation-readout--error"
              : isBusy
                ? " aya-operation-readout--busy"
                : "")
          }
        >
          <div className="aya-operation-readout__primary">{operationLine}</div>
          <div className="aya-operation-readout__secondary">
            {error || contextLine}
          </div>
        </div>
        <button
          type="button"
          className="aya-operation-run-button"
          onClick={onGenerate}
          disabled={isBusy}
          aria-label="开始生成"
        >
          {isBusy ? (
            <span className="loading loading-spinner loading-md" />
          ) : (
            <span className="aya-operation-run-button__ring">
              <Play size={27} fill="currentColor" strokeWidth={1.8} />
            </span>
          )}
        </button>
      </div>
      </div>
      </div>
    </section>
  );
};

export const ImageEditWorkbench = (props) => {
  const {
    error,
    autoRefreshInput,
    isBusy,
    isDashscopeProvider,
    isGeminiProvider,
    generationMode,
    onCaptureCanvasInputImage,
    onCaptureLayerInputImage,
    onClearReferenceImages,
    onClearUploadedInputImage,
    onGenerate,
    onRemoveReferenceImage,
    onRefreshBoundInputImage,
    onToggleAutoRefreshInput,
    onRunAddNeutralGrayLayer,
    onRunRemoveBlemishRetouch,
    onRunSetSoftWhiteBrush,
    onUploadInputImage,
    onUploadReferenceImages,
    previewCount,
    prompt,
    providerLabel,
    setPrompt,
    setSettings,
    settings,
    status,
    uploadedInputImage,
    uploadedReferenceImages,
    setGenerationMode,
  } = props;

  const [collapsed, setCollapsed] = React.useState({});
  const toggleCollapse = (key) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="aya-workbench">
      <ResultWorkspace
        {...props}
        collapsed={Boolean(collapsed.result)}
        onToggleCollapse={() => toggleCollapse("result")}
      />

      <OperationCard
        collapsed={Boolean(collapsed.operation)}
        error={error}
        generationMode={generationMode}
        isBusy={isBusy}
        onGenerate={onGenerate}
        onToggleCollapse={() => toggleCollapse("operation")}
        previewCount={previewCount}
        providerLabel={providerLabel}
        settings={settings}
        status={status}
        uploadedInputImage={uploadedInputImage}
        uploadedReferenceImages={uploadedReferenceImages}
      />

      <UploadCard
        autoRefreshInput={autoRefreshInput}
        collapsed={Boolean(collapsed.upload)}
        generationMode={generationMode}
        isBusy={isBusy}
        onCaptureCanvasInputImage={onCaptureCanvasInputImage}
        onCaptureLayerInputImage={onCaptureLayerInputImage}
        onClearReferenceImages={onClearReferenceImages}
        onClearUploadedInputImage={onClearUploadedInputImage}
        onRemoveReferenceImage={onRemoveReferenceImage}
        onRefreshBoundInputImage={onRefreshBoundInputImage}
        onToggleAutoRefreshInput={onToggleAutoRefreshInput}
        onToggleCollapse={() => toggleCollapse("upload")}
        onUploadInputImage={onUploadInputImage}
        onUploadReferenceImages={onUploadReferenceImages}
        setGenerationMode={setGenerationMode}
        uploadedInputImage={uploadedInputImage}
        uploadedReferenceImages={uploadedReferenceImages}
      />

      <div className="aya-workbench__controls">
        <ShortcutCard
          collapsed={Boolean(collapsed.shortcut)}
          isBusy={isBusy}
          onToggleCollapse={() => toggleCollapse("shortcut")}
          onRunAddNeutralGrayLayer={onRunAddNeutralGrayLayer}
          onRunRemoveBlemishRetouch={onRunRemoveBlemishRetouch}
          onRunSetSoftWhiteBrush={onRunSetSoftWhiteBrush}
        />
        <ParameterCard
          collapsed={Boolean(collapsed.parameter)}
          isBusy={isBusy}
          isDashscopeProvider={isDashscopeProvider}
          isGeminiProvider={isGeminiProvider}
          onToggleCollapse={() => toggleCollapse("parameter")}
          prompt={prompt}
          setPrompt={setPrompt}
          setSettings={setSettings}
          settings={settings}
        />
      </div>
    </div>
  );
};
