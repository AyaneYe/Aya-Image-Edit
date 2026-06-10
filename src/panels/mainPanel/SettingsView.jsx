import React from "react";

import {
  PROVIDER_DASHSCOPE,
  PROVIDER_GEMINI,
  PROVIDER_OPENAI,
} from "./aiProvider.js";
import { GEMINI_MODEL_OPTIONS } from "./sharedSettings.js";

import "./SettingsView.css";

const CARD_CLASS = "card border border-base-300 bg-base-200 shadow-sm";
const CARD_BODY_CLASS = "card-body gap-4 p-4";
const TITLE_CLASS = "card-title text-sm font-semibold";
const FIELD_CLASS = "fieldset";
const LABEL_CLASS = "fieldset-legend";
const INPUT_CLASS = "input input-sm w-full";
const SELECT_CLASS = "select select-sm w-full";

export const SettingsView = ({ activeProvider, isBusy, setSettings, settings }) => {
  const isGeminiProvider = activeProvider === PROVIDER_GEMINI;
  const isOpenAIProvider = activeProvider === PROVIDER_OPENAI;
  const apiKeyLabel = isGeminiProvider
    ? "Gemini 密钥"
    : isOpenAIProvider
      ? "OpenAI 密钥"
      : "DashScope 密钥";
  const apiKeyValue = isGeminiProvider
    ? settings.geminiApiKey
    : isOpenAIProvider
      ? settings.openaiApiKey
      : settings.apiKey;

  return (
    <div className="aya-settings-view">
      <section className={CARD_CLASS}>
        <div className={CARD_BODY_CLASS}>
          <h2 className={TITLE_CLASS}>模型与密钥</h2>

          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>提供商</span>
            <select
              className={SELECT_CLASS}
              value={activeProvider}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  provider: event.target.value,
                }))
              }
              disabled={isBusy}
            >
              <option value={PROVIDER_DASHSCOPE}>DashScope</option>
              <option value={PROVIDER_GEMINI}>Gemini</option>
              <option value={PROVIDER_OPENAI}>OpenAI</option>
            </select>
          </label>

          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>{apiKeyLabel}</span>
            <input
              className={INPUT_CLASS}
              type="password"
              value={apiKeyValue}
              onChange={(event) => {
                const value = event.target.value;
                setSettings((current) => {
                  if (isGeminiProvider) {
                    return { ...current, geminiApiKey: value };
                  }
                  if (isOpenAIProvider) {
                    return { ...current, openaiApiKey: value };
                  }
                  return { ...current, apiKey: value };
                });
              }}
              disabled={isBusy}
            />
          </label>

          {isOpenAIProvider ? (
            <label className={FIELD_CLASS}>
              <span className={LABEL_CLASS}>API URL</span>
              <input
                className={INPUT_CLASS}
                type="url"
                value={settings.openaiBaseUrl}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    openaiBaseUrl: event.target.value,
                  }))
                }
                disabled={isBusy}
                placeholder="https://api.openai.com/v1/images/edits"
              />
            </label>
          ) : null}

          <label className={FIELD_CLASS}>
            <span className={LABEL_CLASS}>模型</span>
            {isGeminiProvider ? (
              <select
                className={SELECT_CLASS}
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
                className={INPUT_CLASS}
                type="text"
                value={isOpenAIProvider ? settings.openaiModel : settings.model}
                onChange={(event) => {
                  const value = event.target.value;
                  setSettings((current) =>
                    isOpenAIProvider
                      ? { ...current, openaiModel: value }
                      : { ...current, model: value }
                  );
                }}
                disabled={isBusy}
              />
            )}
          </label>

        </div>
      </section>
    </div>
  );
};
