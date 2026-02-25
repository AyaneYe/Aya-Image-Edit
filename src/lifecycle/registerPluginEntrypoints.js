import { uxpEntrypointsSchema } from "@bubblydoo/uxp-toolkit";
import { entrypoints } from "uxp";

export function registerPluginEntrypoints({ panels }) {
  entrypoints.setup({
    plugin: {
      create(plugin) {
        const parsed = uxpEntrypointsSchema.safeParse(plugin);
        if (!parsed.success) {
          console.warn("Unexpected plugin metadata shape", parsed.error);
        }
      },
      destroy() {
        // no-op
      },
    },
    panels,
  });
}
