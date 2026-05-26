import React from "react";

import { ResultWorkspace } from "./ResultWorkspace.jsx";

import "./ImageEditWorkbench.css";

const InputContextCard = ({
  isBusy,
  onRunAddNeutralGrayLayer,
  onRunRemoveBlemishRetouch,
  onRunSetSoftWhiteBrush,
  previewCount,
  providerLabel,
  settings,
}) => (
  <section className="aya-workbench-card aya-workbench-card--accent">
    <div className="aya-workbench-card__header">
      <div>
        <div className="aya-workbench-card__eyebrow">当前状态</div>
        <h2 className="aya-workbench-card__title">工作区</h2>
      </div>
    </div>

    <div className="aya-workbench-card__body">
      <div className="aya-context-grid">
        <div className="aya-context-chip">
          <span className="aya-context-chip__label">模型</span>
          <span className="aya-context-chip__value">{providerLabel}</span>
        </div>
        <div className="aya-context-chip">
          <span className="aya-context-chip__label">自动回填</span>
          <span className="aya-context-chip__value">
            {settings.autoSendMode === "selection"
              ? "当前选区"
              : settings.autoSendMode === "original"
                ? "原始位置"
                : "关闭"}
          </span>
        </div>
        <div className="aya-context-chip">
          <span className="aya-context-chip__label">结果数</span>
          <span className="aya-context-chip__value">{previewCount}</span>
        </div>
      </div>

      <div className="aya-retouch-shortcuts">
        <div className="aya-retouch-shortcuts__label">快速修图</div>
        <div className="aya-retouch-shortcuts__actions">
          <button
            type="button"
            className="aya-button aya-button--ghost aya-retouch-shortcuts__button"
            onClick={onRunRemoveBlemishRetouch}
            disabled={isBusy}
          >
            去除瑕疵
          </button>
          <button
            type="button"
            className="aya-button aya-button--ghost aya-retouch-shortcuts__button"
            onClick={onRunAddNeutralGrayLayer}
            disabled={isBusy}
          >
            添加中性灰层
          </button>
          <button
            type="button"
            className="aya-button aya-button--ghost aya-retouch-shortcuts__button"
            onClick={onRunSetSoftWhiteBrush}
            disabled={isBusy}
          >
            瑕疵笔刷
          </button>
        </div>
      </div>
    </div>
  </section>
);

const ParameterCard = ({
  isBusy,
  isDashscopeProvider,
  onOpenSettings,
  prompt,
  setPrompt,
  setSettings,
  settings,
}) => (
  <section className="aya-workbench-card">
    <div className="aya-workbench-card__header">
      <div>
        <div className="aya-workbench-card__eyebrow">参数</div>
        <h2 className="aya-workbench-card__title">编辑参数</h2>
      </div>
      <button
        type="button"
        className="aya-button aya-button--ghost"
        onClick={onOpenSettings}
        disabled={isBusy}
      >
        设置
      </button>
    </div>

    <div className="aya-workbench-card__body">
      <label className="aya-form-field">
        <span className="aya-form-field__label">提示词</span>
        <textarea
          className="aya-textarea"
          rows={7}
          placeholder="描述要如何修改当前选区"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isBusy}
        />
      </label>

      {isDashscopeProvider ? (
        <>
          <div className="aya-field-grid">
            <label className="aya-form-field">
              <span className="aya-form-field__label">输出尺寸</span>
              <input
                className="aya-field"
                type="text"
                value={settings.size}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, size: event.target.value }))
                }
                disabled={isBusy}
                placeholder="1536*1024"
              />
            </label>
            <label className="aya-form-field">
              <span className="aya-form-field__label">反向提示词</span>
              <input
                className="aya-field"
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
            <label className="aya-inline-toggle">
              <input
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
              <span>启用提示词扩写</span>
            </label>

            <label className="aya-inline-toggle">
              <input
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
              <span>添加水印</span>
            </label>
          </div>
        </>
      ) : (
        <div className="aya-field-grid">
          <label className="aya-form-field">
            <span className="aya-form-field__label">宽高比</span>
            <select
              className="aya-field"
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
          <label className="aya-form-field">
            <span className="aya-form-field__label">图像尺寸</span>
            <select
              className="aya-field"
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
      )}
    </div>
  </section>
);

const OperationCard = ({ error, isBusy, onGenerate, onOpenSettings, previewCount, status }) => {
  const toneClass = error
    ? " aya-operation-state--error"
    : isBusy
      ? " aya-operation-state--busy"
      : " aya-operation-state--ready";

  const copy = error ? error : status ? status : "请选择选区并输入提示词。";

  return (
    <section className="aya-workbench-card">
      <div className="aya-workbench-card__header">
        <div>
          <div className="aya-workbench-card__eyebrow">状态</div>
          <h2 className="aya-workbench-card__title">执行状态</h2>
        </div>
      </div>

      <div className="aya-workbench-card__body">
        <div className={"aya-operation-state" + toneClass}>
          <div className="aya-operation-state__heading">
            <span>{error ? "需处理" : isBusy ? "处理中" : "就绪"}</span>
            <span>{previewCount} 张结果</span>
          </div>
          <div className="aya-operation-state__copy">{copy}</div>
        </div>

        <div className="aya-action-row">
          <button type="button" className="aya-button" onClick={onGenerate} disabled={isBusy}>
            {isBusy ? "生成中..." : "开始生成"}
          </button>
          <button
            type="button"
            className="aya-button aya-button--secondary"
            onClick={onOpenSettings}
            disabled={isBusy}
          >
            设置
          </button>
        </div>
      </div>
    </section>
  );
};

export const ImageEditWorkbench = (props) => {
  const {
    error,
    isBusy,
    isDashscopeProvider,
    onGenerate,
    onOpenSettings,
    onRunAddNeutralGrayLayer,
    onRunRemoveBlemishRetouch,
    onRunSetSoftWhiteBrush,
    previewCount,
    prompt,
    providerLabel,
    setPrompt,
    setSettings,
    settings,
    status,
  } = props;

  return (
    <div className="aya-workbench">
      <div className="aya-workbench__rail">
        <InputContextCard
          isBusy={isBusy}
          onRunAddNeutralGrayLayer={onRunAddNeutralGrayLayer}
          onRunRemoveBlemishRetouch={onRunRemoveBlemishRetouch}
          onRunSetSoftWhiteBrush={onRunSetSoftWhiteBrush}
          previewCount={previewCount}
          providerLabel={providerLabel}
          settings={settings}
        />
        <ParameterCard
          isBusy={isBusy}
          isDashscopeProvider={isDashscopeProvider}
          onOpenSettings={onOpenSettings}
          prompt={prompt}
          setPrompt={setPrompt}
          setSettings={setSettings}
          settings={settings}
        />
        <OperationCard
          error={error}
          isBusy={isBusy}
          onGenerate={onGenerate}
          onOpenSettings={onOpenSettings}
          previewCount={previewCount}
          status={status}
        />
      </div>

      <ResultWorkspace {...props} />
    </div>
  );
};
