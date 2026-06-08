let nextRequestId = 0;
const pendingRequests = new Map();
const hostEventHandlers = new Map();

function formatBridgeErrorMessage(errorPayload) {
  if (!errorPayload || typeof errorPayload !== "object") {
    return "未知桥接错误";
  }

  const message =
    typeof errorPayload.message === "string" && errorPayload.message.trim()
      ? errorPayload.message.trim()
      : "未知桥接错误";
  const details =
    typeof errorPayload.details === "string" && errorPayload.details.trim()
      ? errorPayload.details.trim()
      : "";

  if (!details || details === message) {
    return message;
  }

  return `${message}\n${details}`;
}

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

export function subscribeHostEvent(eventName, handler) {
  if (typeof eventName !== "string" || !eventName || typeof handler !== "function") {
    return () => {};
  }

  const handlers = hostEventHandlers.get(eventName) || new Set();
  handlers.add(handler);
  hostEventHandlers.set(eventName, handlers);

  return () => {
    handlers.delete(handler);
    if (!handlers.size) {
      hostEventHandlers.delete(eventName);
    }
  };
}

function dispatchHostEvent(eventName, payload) {
  const handlers = hostEventHandlers.get(eventName);
  if (!handlers) {
    return;
  }

  for (const handler of Array.from(handlers)) {
    try {
      handler(payload);
    } catch (error) {
      console.warn("[Bridge] host event handler failed", error);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const payload = event?.data;

    if (!payload || typeof payload !== "object") {
      return;
    }

    if (!("id" in payload)) {
      if (
        payload.bridge === "aya-image-edit" &&
        payload.type === "event" &&
        typeof payload.event === "string"
      ) {
        dispatchHostEvent(payload.event, payload.payload);
      }
      return;
    }

    const request = pendingRequests.get(String(payload.id));
    if (!request) {
      return;
    }

    pendingRequests.delete(String(payload.id));

    if (payload.error) {
      const error = new Error(formatBridgeErrorMessage(payload.error));
      if (typeof payload.error.stack === "string" && payload.error.stack.trim()) {
        error.stack = payload.error.stack;
      }
      request.reject(error);
      return;
    }

    request.resolve(payload.result);
  });
}
