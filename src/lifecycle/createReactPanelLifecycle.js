import { createRoot } from "react-dom/client";

export function createReactPanelLifecycle(renderPanel) {
  let root = null;
  let reactRoot = null;
  let attachment = null;

  const create = () => {
    if (root) return root;

    root = document.createElement("div");
    root.style.height = "100vh";
    root.style.overflow = "auto";
    root.style.padding = "8px";

    reactRoot = createRoot(root);
    reactRoot.render(renderPanel());
    return root;
  };

  return {
    create() {
      return create();
    },
    show(event) {
      if (!root) create();
      attachment = event;
      attachment.appendChild(root);
    },
    hide() {
      if (attachment && root) {
        attachment.removeChild(root);
        attachment = null;
      }
    },
    destroy() {
      if (reactRoot) {
        reactRoot.unmount();
      }
      reactRoot = null;
      root = null;
      attachment = null;
    },
  };
}
