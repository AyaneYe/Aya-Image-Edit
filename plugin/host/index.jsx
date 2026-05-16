import { setupBridge, teardownBridge } from "./bridgeHandlers.js";

const { entrypoints } = require("uxp");

const PANEL_ID = "ayaImageEdit";
const APP_URL = "plugin:/app.html";

let panelContainer = null;
let mainWebview = null;

try {
  const runtimeGlobal =
    typeof globalThis !== "undefined" ? globalThis : window;
  runtimeGlobal.screen = runtimeGlobal.screen || {};
} catch (error) {
  console.warn("[aya-webview] failed to initialize screen shim", error);
}

try {
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  document.documentElement.style.margin = "0";
  document.documentElement.style.padding = "0";
  document.documentElement.style.overflow = "hidden";

  document.body.style.width = "100%";
  document.body.style.height = "100%";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#0e1118";
} catch (error) {
  console.warn("[aya-webview] failed to initialize host document sizing", error);
}

function getPanelNode(panelRef) {
  if (panelRef && panelRef.node) {
    return panelRef.node;
  }

  return panelRef || null;
}

function ensurePanelContainer() {
  if (panelContainer) {
    return panelContainer;
  }

  panelContainer = document.createElement("div");
  panelContainer.style.cssText =
    "display:block;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0;overflow:hidden;background:#0e1118;";

  mainWebview = document.createElement("webview");
  mainWebview.id = "aya-main-webview";
  mainWebview.setAttribute("src", APP_URL);
  mainWebview.style.cssText =
    "display:block;width:100%;height:100%;margin:0;padding:0;border:none;position:absolute;inset:0;";

  panelContainer.appendChild(mainWebview);
  setupBridge(mainWebview);

  return panelContainer;
}

function mountPanel(panelRef) {
  const node = getPanelNode(panelRef);
  if (!node) {
    return;
  }

  const container = ensurePanelContainer();
  node.innerHTML = "";
  node.style.margin = "0";
  node.style.padding = "0";
  node.style.width = "100%";
  node.style.height = "100%";
  node.style.minHeight = "100%";
  node.style.position = "relative";
  node.style.overflow = "hidden";
  node.style.display = "block";
  node.appendChild(container);
}

entrypoints.setup({
  plugin: {
    create() {
      console.log("[aya-webview] plugin created");
    },
    destroy() {
      teardownBridge();
      console.log("[aya-webview] plugin destroyed");
    },
  },
  panels: {
    [PANEL_ID]: {
      show(panelRef) {
        mountPanel(panelRef);
      },
      hide() {},
      menuItems: [
        {
          id: "reload",
          label: "Reload Plugin",
          enabled: true,
          checked: false,
          oninvoke() {
            location.reload();
          },
        },
      ],
    },
  },
});
