import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";

const rootElement = document.getElementById("root");

function escapeHtml(value) {
  return String(value ?? "").replace(/[<>&]/g, (character) => {
    return {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
    }[character];
  });
}

function renderFatal(title, detail, retryable = false) {
  const target = rootElement || document.body;
  if (!target) {
    return;
  }

  target.innerHTML = `
    <div style="padding:16px;color:#fff;background:#111826;font:12px/1.6 Segoe UI,sans-serif;height:100%;box-sizing:border-box;">
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;color:#ffb365;">${escapeHtml(title)}</div>
      <pre style="white-space:pre-wrap;word-break:break-word;margin:0;color:#d8e2f0;">${escapeHtml(detail)}</pre>
      ${
        retryable
          ? '<button id="aya-retry" style="margin-top:14px;border:0;border-radius:999px;padding:9px 14px;background:#67c6ff;color:#08121d;cursor:pointer;font-weight:600;">重试</button>'
          : ""
      }
    </div>
  `;

  if (retryable) {
    const retryButton = document.getElementById("aya-retry");
    if (retryButton) {
      retryButton.onclick = () => {
        window.location.reload();
      };
    }
  }
}

window.onerror = (message, url, line, column, error) => {
  const detail = error?.stack || `${message} (${url}:${line}:${column})`;
  renderFatal("WebView 启动失败", detail);
  return true;
};

window.onunhandledrejection = (event) => {
  const reason = event?.reason;
  renderFatal(
    "WebView 初始化失败",
    reason?.stack || reason?.message || String(reason),
    true
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 16,
            color: "#fff",
            background: "#111826",
            font: "12px/1.6 Segoe UI, sans-serif",
            height: "100%",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 8,
              color: "#ffb365",
            }}
          >
            界面渲染失败
          </div>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

async function bootstrap() {
  if (!rootElement) {
    renderFatal("缺少根节点", "app.html 中未找到 #root 容器。");
    return;
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    renderFatal("插件初始化失败", error?.message || String(error), true);
  }
}

void bootstrap();
