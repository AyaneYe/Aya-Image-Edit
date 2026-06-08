import React from "react";
import { ChevronDown, ImageOff } from "lucide-react";

import "./ResultWorkspace.css";

export const ResultWorkspace = ({
  canGoNext,
  canGoPrevious,
  collapsed,
  isBusy,
  onClearPreviews,
  onDeleteSelectedPreview,
  onSaveSelectedPreview,
  onSelectNext,
  onSelectPreview,
  onSelectPrevious,
  onSendSelectedPreview,
  onToggleCollapse,
  previewItems,
  selectedPreview,
  selectedPreviewId,
  selectedPreviewIndex,
}) => (
  <section className="aya-result-workspace card border border-base-300 bg-base-200 shadow-sm">
    <div className="card-body gap-4 p-4">
      <button
        type="button"
        className="aya-card-header"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        <span className="card-title text-sm font-semibold">结果预览</span>
        <span className="aya-card-header__right">
          {previewItems.length ? (
            <span className="badge badge-neutral badge-sm">
              {selectedPreviewIndex + 1} / {previewItems.length}
            </span>
          ) : null}
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={"aya-panel-chevron" + (collapsed ? " aya-panel-chevron--collapsed" : "")}
            aria-hidden="true"
          />
        </span>
      </button>

      {collapsed ? null : (
      <>
      <div className="aya-result-workspace__preview">
        {selectedPreview ? (
          <img
            className="aya-result-workspace__image"
            src={selectedPreview.url}
            alt="生成结果预览"
          />
        ) : (
          <div className="aya-result-workspace__empty">
            <ImageOff size={28} strokeWidth={1.6} className="opacity-50" />
            <div className="text-sm font-semibold text-base-content">暂无结果</div>
            <div className="text-xs text-base-content/55">生成的图片会显示在这里</div>
          </div>
        )}
      </div>

      <div className="aya-result-workspace__nav">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onSelectPrevious}
          disabled={isBusy || !canGoPrevious}
        >
          上一张
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onSelectNext}
          disabled={isBusy || !canGoNext}
        >
          下一张
        </button>
      </div>

      <div className="aya-result-workspace__actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSendSelectedPreview("original")}
          disabled={isBusy || !selectedPreview || !selectedPreview.boundsAtStart}
        >
          发送到原始位置
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onSendSelectedPreview("selection")}
          disabled={isBusy || !selectedPreview}
        >
          发送到当前选区
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onSaveSelectedPreview}
          disabled={isBusy || !selectedPreview}
        >
          保存
        </button>
        <button
          type="button"
          className="btn btn-error"
          onClick={onDeleteSelectedPreview}
          disabled={isBusy || !selectedPreview}
        >
          删除
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClearPreviews}
          disabled={isBusy || !previewItems.length}
        >
          清空
        </button>
      </div>

      {previewItems.length ? (
        <div className="aya-result-workspace__strip">
          {previewItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={
                "btn h-auto min-h-0 flex-col items-stretch justify-start gap-2 border p-2 normal-case" +
                (item.id === selectedPreviewId
                  ? " btn-primary border-primary"
                  : " btn-ghost border-base-300 bg-base-100")
              }
              onClick={() => onSelectPreview(item.id)}
              disabled={isBusy}
              aria-pressed={item.id === selectedPreviewId}
            >
              <div className="aya-result-workspace__thumb-image-wrap">
                <img
                  className="aya-result-workspace__thumb-image"
                  src={item.url}
                  alt={`结果 ${index + 1}`}
                />
              </div>
              <span className="text-left text-xs font-semibold">结果 {index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}
      </>
      )}
    </div>
  </section>
);
