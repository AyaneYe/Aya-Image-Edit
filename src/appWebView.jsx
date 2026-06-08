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
    <div data-theme="dark" class="flex min-h-full items-center justify-center bg-base-100 p-4">
      <div class="card w-full max-w-xl border border-error bg-base-200 shadow-sm">
        <div class="card-body gap-4">
          <div class="alert alert-error">${escapeHtml(title)}</div>
          <pre class="m-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-base-content/80">${escapeHtml(detail)}</pre>
      ${
        retryable
          ? '<button id="aya-retry" class="btn btn-primary btn-sm self-start">重试</button>'
          : ""
      }
        </div>
      </div>
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
        <div className="flex min-h-full items-center justify-center bg-base-100 p-4" data-theme="dark">
          <div className="card w-full max-w-xl border border-error bg-base-200 shadow-sm">
            <div className="card-body gap-4">
              <div className="alert alert-error">界面渲染失败</div>
              <pre className="m-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-base-content/80">
                {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
              </pre>
            </div>
          </div>
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
