let nextRequestId = 0;
const pendingRequests = new Map();

export function isInWebView() {
  return (
    typeof window !== "undefined" &&
    window.uxpHost &&
    typeof window.uxpHost.postMessage === "function"
  );
}

export function invoke(method, ...args) {
  if (!isInWebView()) {
    return Promise.reject(new Error("[Bridge] 当前运行环境不在 WebView 中。"));
  }

  const id = `aya_${Date.now()}_${++nextRequestId}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    window.uxpHost.postMessage({
      id,
      method,
      args,
    });
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const payload = event?.data;

    if (!payload || typeof payload !== "object" || !("id" in payload)) {
      return;
    }

    const request = pendingRequests.get(String(payload.id));
    if (!request) {
      return;
    }

    pendingRequests.delete(String(payload.id));

    if (payload.error) {
      request.reject(new Error(payload.error.message || "未知桥接错误"));
      return;
    }

    request.resolve(payload.result);
  });
}
