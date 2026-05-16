import React from "react";

import { ImageEditWorkbench } from "./ImageEditWorkbench.jsx";
import { SettingsView } from "./SettingsView.jsx";

import "./ImageEditShell.css";

export const ImageEditShell = (props) => {
  const {
    error,
    isBusy,
    onOpenSettings,
    onOpenWorkbench,
    previewCount,
    providerLabel,
    activeView,
  } = props;

  const shellSummary = error
    ? "需处理"
    : isBusy
      ? "处理中"
      : previewCount
        ? `${previewCount} 张结果`
        : "就绪";

  return (
    <div className="aya-shell">
      <header className="aya-shell__topbar">
        <div className="aya-shell__brand">
          <div className="aya-shell__title-row">
            <h1 className="aya-shell__title">Aya Image Edit</h1>
            <span
              className={
                "aya-shell__status-pill" +
                (error
                  ? " aya-shell__status-pill--danger"
                  : isBusy
                    ? " aya-shell__status-pill--busy"
                    : "")
              }
            >
              {shellSummary}
            </span>
          </div>
        </div>

        <div className="aya-shell__actions">
          {activeView === "settings" ? (
            <button
              type="button"
              className="aya-button aya-button--secondary"
              onClick={onOpenWorkbench}
              disabled={isBusy}
            >
              返回工作区
            </button>
          ) : (
            <button
              type="button"
              className="aya-button aya-button--secondary"
              onClick={onOpenSettings}
              disabled={isBusy}
            >
              打开设置
            </button>
          )}
        </div>
      </header>

      <main className="aya-shell__content">
        {activeView === "settings" ? <SettingsView {...props} /> : <ImageEditWorkbench {...props} />}
      </main>
    </div>
  );
};
