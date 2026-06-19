import React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Crosshair,
  Download,
  Eye,
  ImageOff,
  Trash,
  Trash2,
} from "lucide-react";

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
  <section className="aya-result-workspace aya-tool-panel">
    <button
      type="button"
      className={"aya-tool-panel__header" + (collapsed ? " aya-tool-panel__header--collapsed" : "")}
      onClick={onToggleCollapse}
      aria-expanded={!collapsed}
    >
      <span className="aya-tool-panel__title-wrap">
        <span className="aya-tool-panel__icon">
          <Eye size={16} strokeWidth={1.8} />
        </span>
        <span className="aya-tool-panel__title">结果预览</span>
      </span>
      <span className="aya-tool-panel__right">
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

    <div className={"aya-collapse-body" + (collapsed ? " aya-collapse-body--collapsed" : "")}>
      <div className="aya-collapse-body__inner">
        <div className="aya-tool-panel__body">
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

            <div className="aya-result-workspace__nav">
              <button
                type="button"
                className="btn btn-circle btn-sm"
                onClick={onSelectPrevious}
                disabled={isBusy || !canGoPrevious}
                title="上一张"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn btn-circle btn-sm"
                onClick={onSelectNext}
                disabled={isBusy || !canGoNext}
                title="下一张"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="aya-result-workspace__actions">
              <button
                type="button"
                className="btn btn-circle btn-sm btn-primary"
                onClick={() => onSendSelectedPreview("original")}
                disabled={isBusy || !selectedPreview || !selectedPreview.boundsAtStart}
                title="发送到原始位置"
              >
                <CornerUpLeft size={16} />
              </button>
              <button
                type="button"
                className="btn btn-circle btn-sm btn-secondary"
                onClick={() => onSendSelectedPreview("selection")}
                disabled={isBusy || !selectedPreview}
                title="发送到当前选区"
              >
                <Crosshair size={16} />
              </button>
              <button
                type="button"
                className="btn btn-circle btn-sm btn-secondary"
                onClick={onSaveSelectedPreview}
                disabled={isBusy || !selectedPreview}
                title="保存"
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                className="btn btn-circle btn-sm btn-error"
                onClick={onDeleteSelectedPreview}
                disabled={isBusy || !selectedPreview}
                title="删除"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                className="btn btn-circle btn-sm btn-ghost"
                onClick={onClearPreviews}
                disabled={isBusy || !previewItems.length}
                title="清空"
              >
                <Trash size={16} />
              </button>
            </div>
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
        </div>
      </div>
    </div>
  </section>
);
