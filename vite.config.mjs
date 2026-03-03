import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { uxp } from "@bubblydoo/vite-uxp-plugin";
import { manifest } from "./uxp.config.mjs";

export default defineConfig({
  plugins: [react(), uxp(manifest)],
});
