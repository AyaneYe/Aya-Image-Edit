import { uxpEntrypointsSchema } from "@bubblydoo/uxp-toolkit";
import { entrypoints } from "uxp";

export function registerPluginEntrypoints({ panels }) {
  const stamp = new Date().toISOString();
  console.log(`[AyaImageEdit][Lifecycle][${stamp}] entrypoints.setup:start`, {
    panelIds: Object.keys(panels || {}),
  });

  entrypoints.setup({
    plugin: {
      create(plugin) {
        console.log(
          `[AyaImageEdit][Lifecycle][${new Date().toISOString()}] plugin:create`,
          plugin,
        );
        const parsed = uxpEntrypointsSchema.safeParse(plugin);
        if (!parsed.success) {
          console.warn("Unexpected plugin metadata shape", parsed.error);
        }
      },
      destroy() {
        console.log(
          `[AyaImageEdit][Lifecycle][${new Date().toISOString()}] plugin:destroy`,
        );
      },
    },
    panels,
  });

  console.log(
    `[AyaImageEdit][Lifecycle][${new Date().toISOString()}] entrypoints.setup:done`,
  );
}
