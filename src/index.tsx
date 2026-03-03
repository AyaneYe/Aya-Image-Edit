import React from "react";
import "@bubblydoo/vite-uxp-plugin/runtime";

import "./styles.css";
import { MainPanel } from "./features/imageEdit";
import { createReactPanelLifecycle } from "./lifecycle/createReactPanelLifecycle";
import { registerPluginEntrypoints } from "./lifecycle/registerPluginEntrypoints";

registerPluginEntrypoints({
  panels: {
    demos: createReactPanelLifecycle(() => <MainPanel />),
  },
});
