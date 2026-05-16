import React from "react";

import "./ResultWorkspace.css";

export const ResultWorkspace = ({
  canGoNext,
  canGoPrevious,
  isBusy,
  onClearPreviews,
  onDeleteSelectedPreview,
  onSaveSelectedPreview,
  onSelectNext,
  onSelectPreview,
  onSelectPrevious,
  onSendSelectedPreview,
  previewItems,
  selectedPreview,
  selectedPreviewId,
  selectedPreviewIndex,
}) => (
  <section className="aya-result-workspace">
    <div className="aya-result-workspace__header">
      <div>
        <div className="aya-workbench-card__eyebrow">结果</div>
        <h2 className="aya-result-workspace__title">结果预览</h2>
      </div>

      {previewItems.length ? (
        <div className="aya-result-workspace__count">
          {selectedPreviewIndex + 1} / {previewItems.length}
        </div>
      ) : null}
    </div>

    <div className="aya-result-workspace__preview">
      {selectedPreview ? (
        <img
          className="aya-result-workspace__image"
          src={selectedPreview.url}
          alt="生成结果预览"
        />
      ) : (
        <div className="aya-result-workspace__empty">
          <div className="aya-result-workspace__empty-title">暂无结果</div>
        </div>
      )}
    </div>

    <div className="aya-result-workspace__nav">
      <button
        type="button"
        className="aya-button aya-button--ghost"
        onClick={onSelectPrevious}
        disabled={isBusy || !canGoPrevious}
      >
        上一张
      </button>
      <button
        type="button"
        className="aya-button aya-button--ghost"
        onClick={onSelectNext}
        disabled={isBusy || !canGoNext}
      >
        下一张
      </button>
    </div>

    <div className="aya-result-workspace__actions">
      <button
        type="button"
        className="aya-button"
        onClick={() => onSendSelectedPreview("original")}
        disabled={isBusy || !selectedPreview}
      >
        发送到原始位置
      </button>
      <button
        type="button"
        className="aya-button aya-button--secondary"
        onClick={() => onSendSelectedPreview("selection")}
        disabled={isBusy || !selectedPreview}
      >
        发送到当前选区
      </button>
      <button
        type="button"
        className="aya-button aya-button--secondary"
        onClick={onSaveSelectedPreview}
        disabled={isBusy || !selectedPreview}
      >
        保存
      </button>
      <button
        type="button"
        className="aya-button aya-button--danger"
        onClick={onDeleteSelectedPreview}
        disabled={isBusy || !selectedPreview}
      >
        删除
      </button>
      <button
        type="button"
        className="aya-button aya-button--ghost"
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
              "aya-result-workspace__thumb" +
              (item.id === selectedPreviewId ? " aya-result-workspace__thumb--active" : "")
            }
            onClick={() => onSelectPreview(item.id)}
            disabled={isBusy}
          >
            <div className="aya-result-workspace__thumb-image-wrap">
              <img
                className="aya-result-workspace__thumb-image"
                src={item.url}
                alt={`结果 ${index + 1}`}
              />
            </div>
            <span className="aya-result-workspace__thumb-label">结果 {index + 1}</span>
          </button>
        ))}
      </div>
    ) : null}
  </section>
);
