import React from "react";

import { GEMINI_MODEL_OPTIONS } from "./sharedSettings.js";

import "./SettingsView.css";

export const SettingsView = ({ activeProvider, isBusy, setSettings, settings }) => (
  <div className="aya-settings-view">
    <section className="aya-settings-card">
      <div className="aya-settings-card__header">
        <div className="aya-workbench-card__eyebrow">提供商</div>
        <h2 className="aya-settings-card__title">模型与密钥</h2>
      </div>

      <div className="aya-settings-card__body">
        <label className="aya-form-field">
          <span className="aya-form-field__label">提供商</span>
          <select
            className="aya-field"
            value={activeProvider}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                provider: event.target.value,
              }))
            }
            disabled={isBusy}
          >
            <option value="dashscope">DashScope</option>
            <option value="gemini">Gemini</option>
          </select>
        </label>

        <label className="aya-form-field">
          <span className="aya-form-field__label">
            {activeProvider === "gemini" ? "Gemini 密钥" : "DashScope 密钥"}
          </span>
          <input
            className="aya-field"
            type="password"
            value={activeProvider === "gemini" ? settings.geminiApiKey : settings.apiKey}
            onChange={(event) => {
              const value = event.target.value;
              setSettings((current) =>
                activeProvider === "gemini"
                  ? { ...current, geminiApiKey: value }
                  : { ...current, apiKey: value }
              );
            }}
            disabled={isBusy}
          />
        </label>

        <label className="aya-form-field">
          <span className="aya-form-field__label">模型</span>
          {activeProvider === "gemini" ? (
            <select
              className="aya-field"
              value={settings.geminiModel}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  geminiModel: event.target.value,
                }))
              }
              disabled={isBusy}
            >
              {GEMINI_MODEL_OPTIONS.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="aya-field"
              type="text"
              value={settings.model}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              disabled={isBusy}
            />
          )}
        </label>
      </div>
    </section>

    <section className="aya-settings-card">
      <div className="aya-settings-card__header">
        <div className="aya-workbench-card__eyebrow">行为</div>
        <h2 className="aya-settings-card__title">放置默认值</h2>
      </div>

      <div className="aya-settings-card__body">
        <label className="aya-form-field">
          <span className="aya-form-field__label">生成后自动回填</span>
          <select
            className="aya-field"
            value={settings.autoSendMode || "off"}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                autoSendMode: event.target.value,
              }))
            }
            disabled={isBusy}
          >
            <option value="off">关闭</option>
            <option value="original">原始位置</option>
            <option value="selection">当前选区</option>
          </select>
        </label>
      </div>
    </section>
  </div>
);
