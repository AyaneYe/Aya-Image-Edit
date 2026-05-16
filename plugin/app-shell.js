(function installAppShell() {
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[<>&]/g, function (char) {
      return {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
      }[char];
    });
  }

  window.__ayaFatal = function (title, detail, retryable) {
    var root = document.getElementById("root") || document.body;
    if (!root) {
      return;
    }

    root.innerHTML =
      '<div style="padding:16px;color:#fff;background:#111826;font:12px/1.6 Segoe UI,sans-serif;height:100%;box-sizing:border-box;">' +
      '<div style="font-size:16px;font-weight:600;margin-bottom:8px;color:#ffb365;">' +
      escapeHtml(title) +
      "</div>" +
      '<pre style="white-space:pre-wrap;word-break:break-word;margin:0;color:#d8e2f0;">' +
      escapeHtml(detail) +
      "</pre>" +
      (retryable
        ? '<button id="aya-retry" style="margin-top:14px;border:0;border-radius:999px;padding:9px 14px;background:#67c6ff;color:#08121d;cursor:pointer;font-weight:600;">重试</button>'
        : "") +
      "</div>";

    if (retryable) {
      var retryButton = document.getElementById("aya-retry");
      if (retryButton) {
        retryButton.onclick = function () {
          window.location.reload();
        };
      }
    }
  };

  window.onerror = function (message, url, line, column, error) {
    var detail =
      error && error.stack
        ? error.stack
        : String(message) + " (" + url + ":" + line + ":" + column + ")";
    window.__ayaFatal("WebView 启动失败", detail, false);
    return true;
  };

  window.onunhandledrejection = function (event) {
    var reason = event && event.reason ? event.reason : "未知 Promise 异常";
    var detail =
      reason && reason.stack
        ? reason.stack
        : reason && reason.message
          ? reason.message
          : String(reason);
    window.__ayaFatal("WebView 初始化失败", detail, true);
  };
})();
