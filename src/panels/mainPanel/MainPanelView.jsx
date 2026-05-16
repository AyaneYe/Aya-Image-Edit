import React from "react";

import { ImageEditShell } from "./ImageEditShell.jsx";
import { useImageEditWorkbench } from "./useImageEditWorkbench.js";

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
        <div className="aya-root-error">
          <div className="aya-root-error__card">
            <div className="aya-root-error__title">面板渲染出错。</div>
            <pre className="aya-root-error__detail">
              {this.state.error?.message || String(this.state.error)}
            </pre>
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
