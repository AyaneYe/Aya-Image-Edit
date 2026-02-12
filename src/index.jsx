import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { MainPanel } from "./panels/MainPanel.jsx";

import { entrypoints } from "uxp";

const mainPanelController = new PanelController(() => <MainPanel />, { id: "demos" });

entrypoints.setup({
    plugin: {
        create(plugin) {
            /* optional */ console.log("created", plugin);
        },
        destroy() {
            /* optional */ console.log("destroyed");
        }
    },
    panels: {
        demos: mainPanelController
    }
});
