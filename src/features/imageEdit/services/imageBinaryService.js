function decodeBase64ToBytes(base64) {
  const clean = String(base64 || "").replace(/\s+/g, "");

  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(clean, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  throw new Error("当前环境不支持 base64 解码");
}

function tryDataUrlToArrayBuffer(url) {
  if (typeof url !== "string" || !url.startsWith("data:")) return null;

  const commaIndex = url.indexOf(",");
  if (commaIndex < 0) throw new Error("data URL 无效");

  const meta = url.slice(5, commaIndex);
  const payload = url.slice(commaIndex + 1);

  if (/;base64/i.test(meta)) {
    const bytes = decodeBase64ToBytes(payload);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  const text = decodeURIComponent(payload);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes.buffer;
}

function inferImageMimeType(url) {
  if (typeof url === "string" && url.startsWith("data:")) {
    const commaIndex = url.indexOf(",");
    const meta = commaIndex > 5 ? url.slice(5, commaIndex) : "";
    const semiIndex = meta.indexOf(";");
    const mime = semiIndex >= 0 ? meta.slice(0, semiIndex) : meta;
    if (mime) return mime;
  }
  return "image/png";
}

export async function fetchArrayBufferFromImageUrl(url) {
  const dataBuffer = tryDataUrlToArrayBuffer(url);
  if (dataBuffer) return dataBuffer;

  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 30000);
  const res = await fetch(url, { signal: controller?.signal }).finally(() =>
    clearTimeout(timeout),
  );
  if (!res.ok) throw new Error(`请求失败: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

export async function tryCreatePreviewObjectUrl(url) {
  try {
    if (typeof Blob === "undefined" || typeof URL?.createObjectURL !== "function") {
      return null;
    }
    const buf = await fetchArrayBufferFromImageUrl(url);
    const blob = new Blob([buf], { type: inferImageMimeType(url) });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function safeRevokeObjectUrl(maybeUrl) {
  if (
    typeof maybeUrl === "string" &&
    maybeUrl.startsWith("blob:") &&
    typeof URL?.revokeObjectURL === "function"
  ) {
    try {
      URL.revokeObjectURL(maybeUrl);
    } catch {
      // ignore
    }
  }
}

export async function downloadAndSaveImage(url) {
  const uxp = require("uxp");
  const fs = uxp.storage.localFileSystem;
  const formats = uxp.storage.formats;

  const buf = await fetchArrayBufferFromImageUrl(url);

  try {
    const file = await fs.getFileForSaving(`aya-result-${Date.now()}.png`);
    if (!file) return { saved: false, reason: "canceled" };
    await file.write(buf, { format: formats.binary });
    return { saved: true, target: file.nativePath || file.name };
  } catch (e) {
    const msg = e?.message || String(e);
    if (/not permitted|file picker|Manifest entry not found/i.test(msg)) {
      throw new Error(
        "插件未获得文件选择器权限：请确认 manifest.json 已包含 requiredPermissions.localFileSystem，并在 PS 中重新加载插件后再试",
      );
    }
    throw e;
  }
}
