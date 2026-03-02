import { createRoot } from "react-dom/client";

function logLifecycle(panelId, phase, details) {
  const stamp = new Date().toISOString();
  if (details) {
    console.log(
      `[AyaImageEdit][Lifecycle][${stamp}][panel:${panelId}] ${phase}`,
      details,
    );
    return;
  }
  console.log(`[AyaImageEdit][Lifecycle][${stamp}][panel:${panelId}] ${phase}`);
}

export function createReactPanelLifecycle(renderPanel, panelId = "unknown") {
  let root = null;
  let reactRoot = null;
  let attachment = null;

  const create = () => {
    if (root) {
      logLifecycle(panelId, "create:skip (already created)");
      return root;
    }
    logLifecycle(panelId, "create:start");

    root = document.createElement("div");
    root.style.height = "100vh";
    root.style.overflow = "auto";
    root.style.padding = "8px";

    reactRoot = createRoot(root);
    reactRoot.render(renderPanel());
    logLifecycle(panelId, "create:done");
    return root;
  };

  return {
    create() {
      logLifecycle(panelId, "entrypoint:create");
      return create();
    },
    show(event) {
      logLifecycle(panelId, "entrypoint:show:start", {
        hasRoot: Boolean(root),
        hasAttachment: Boolean(attachment),
      });
      if (!root) create();
      attachment = event;
      attachment.appendChild(root);
      logLifecycle(panelId, "entrypoint:show:done");
    },
    hide() {
      logLifecycle(panelId, "entrypoint:hide:start", {
        hasRoot: Boolean(root),
        hasAttachment: Boolean(attachment),
      });
      if (attachment && root) {
        attachment.removeChild(root);
        attachment = null;
        logLifecycle(panelId, "entrypoint:hide:done");
        return;
      }
      logLifecycle(panelId, "entrypoint:hide:skip (nothing to detach)");
    },
    destroy() {
      logLifecycle(panelId, "entrypoint:destroy:start", {
        hasRoot: Boolean(root),
        hasReactRoot: Boolean(reactRoot),
        hasAttachment: Boolean(attachment),
      });
      if (reactRoot) {
        reactRoot.unmount();
      }
      reactRoot = null;
      root = null;
      attachment = null;
      logLifecycle(panelId, "entrypoint:destroy:done");
    },
  };
}
