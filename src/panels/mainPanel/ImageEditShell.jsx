import React from "react";
import { ArrowLeft, LayoutDashboard, Settings } from "lucide-react";

import { ImageEditWorkbench } from "./ImageEditWorkbench.jsx";
import { SettingsView } from "./SettingsView.jsx";

import "./ImageEditShell.css";

export const ImageEditShell = (props) => {
  const {
    error,
    isBusy,
    onOpenSettings,
    onOpenWorkbench,
    providerLabel,
    activeView,
  } = props;

  const statusText = error ? "失败" : isBusy ? "处理中" : "就绪";
  const statusTone = error ? "danger" : isBusy ? "busy" : "ready";

  return (
    <div className="aya-shell" data-theme="dark">
      <header className="aya-shell__topbar">
        <div className="aya-shell__workspace">
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square"
            title="切换工作台"
            aria-label="切换工作台"
            disabled={isBusy}
          >
            <LayoutDashboard size={14} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <div className="aya-shell__workspace-meta">
            <span>{providerLabel}</span>
          </div>
        </div>

        <div className="aya-shell__actions">
          <div className="aya-shell__status" title={statusText} aria-label={statusText}>
            <span className={`aya-shell__status-light aya-shell__status-light--${statusTone}`} />
            <span className="aya-shell__status-text">{statusText}</span>
          </div>

          {activeView === "settings" ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={onOpenWorkbench}
              title="返回工作区"
              aria-label="返回工作区"
              disabled={isBusy}
            >
              <ArrowLeft size={14} strokeWidth={2.25} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square"
              onClick={onOpenSettings}
              title="打开设置"
              aria-label="打开设置"
              disabled={isBusy}
            >
              <Settings size={14} strokeWidth={2.25} aria-hidden="true" />
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
