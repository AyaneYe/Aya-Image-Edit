import React from "react";

import { ImageEditShell } from "./components/ImageEditShell.jsx";
import { useImageEditWorkbench } from "./hooks/useImageEditWorkbench.js";

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AyaImageEdit] panel render failed", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-full items-center justify-center p-5" data-theme="dark">
          <div className="card w-full max-w-xl border border-error bg-base-200 shadow-sm">
            <div className="card-body gap-4">
              <div className="alert alert-error">面板渲染出错。</div>
              <pre className="m-0 whitespace-pre-wrap break-words text-xs leading-relaxed text-base-content/80">
                {this.state.error?.message || String(this.state.error)}
              </pre>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const MainPanelInner = () => {
  const shellState = useImageEditWorkbench();
  return <ImageEditShell {...shellState} />;
};

export const MainPanel = () => (
  <PanelErrorBoundary>
    <MainPanelInner />
  </PanelErrorBoundary>
);
