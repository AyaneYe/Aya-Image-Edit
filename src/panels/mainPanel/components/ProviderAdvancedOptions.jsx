import React from "react";

import { checkboxPill, fieldBase, helperText, labelText, sectionTitle } from "../styles";

export const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
];

export const clampImageCount = (value) => {
  const parsed = Number.parseInt(String(value ?? 1), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(4, parsed));
};

export const ProviderAdvancedOptions = ({
  settings,
  setSettings,
  isBusy,
  isDashscopeProvider,
  compact = false,
}) => {
  if (isDashscopeProvider) {
    return (
      <>
        <div className={sectionTitle}>高级参数</div>
        <div className="grid grid-cols-1 gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelText}>返回张数 (1-4)</span>
            <input
              className={fieldBase}
              type="number"
              min={1}
              max={4}
              step={1}
              value={settings.n ?? 1}
              onChange={(event) => {
                const nextValue = clampImageCount(event.target.value);
                setSettings((state) => ({ ...state, n: nextValue }));
              }}
              disabled={isBusy}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelText}>size (可选，如 1536*1024)</span>
            <input
              className={fieldBase}
              type="text"
              value={settings.size}
              onChange={(event) => {
                const value = event.target.value;
                setSettings((state) => ({ ...state, size: value }));
              }}
              disabled={isBusy}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelText}>负面提示词</span>
            <input
              className={fieldBase}
              type="text"
              value={settings.negative_prompt}
              onChange={(event) => {
                const value = event.target.value;
                setSettings((state) => ({ ...state, negative_prompt: value }));
              }}
              disabled={isBusy}
            />
          </label>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={checkboxPill}>
            <input
              type="checkbox"
              checked={Boolean(settings.prompt_extend)}
              onChange={(event) => {
                const checked = event.target.checked;
                setSettings((state) => ({ ...state, prompt_extend: checked }));
              }}
              disabled={isBusy}
            />
            <span>提示词优化</span>
          </label>
          <label className={checkboxPill}>
            <input
              type="checkbox"
              checked={Boolean(settings.watermark)}
              onChange={(event) => {
                const checked = event.target.checked;
                setSettings((state) => ({ ...state, watermark: checked }));
              }}
              disabled={isBusy}
            />
            <span>水印</span>
          </label>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={sectionTitle}>高级参数</div>
      <div className="grid grid-cols-1 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelText}>画幅比例 (可选)</span>
          <select
            className={fieldBase}
            value={settings.geminiAspectRatio || ""}
            onChange={(event) => {
              const value = event.target.value;
              setSettings((state) => ({ ...state, geminiAspectRatio: value }));
            }}
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
        <label className="flex flex-col gap-1">
          <span className={labelText}>分辨率 (可选)</span>
          <select
            className={fieldBase}
            value={settings.geminiImageSize || ""}
            onChange={(event) => {
              const value = event.target.value;
              setSettings((state) => ({ ...state, geminiImageSize: value }));
            }}
            disabled={isBusy}
          >
            <option value="">默认 (1K)</option>
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </label>
      </div>
      {!compact ? (
        <div className={helperText}>Gemini 图片会自带 SynthID 水印。</div>
      ) : null}
    </>
  );
};
