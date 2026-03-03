# Aya-Image-Edit

Aya~Aya~Aya

# How to run
克隆本仓库后，在目录下运行 `pnpm install`

开发（Vite watch 构建）：运行 `pnpm dev`，会在根目录生成 `dist` 文件夹。  
打开 UXP Developer Tools -> Add Plugins，选择 `dist/manifest.json`，点击 `Load` 即可。

生产构建：运行 `pnpm build`。  
打 ccx：运行 `pnpm build:pack`，会生成根目录下的 `io.aya.imageedit.ccx`。

# Structure (uxp-toolkit + vite-uxp-plugin)

- `uxp.config.mjs`: UXP manifest 配置（由 Vite 插件输出到 `dist/manifest.json`）
- `vite.config.mjs`: Vite + `@bubblydoo/vite-uxp-plugin` 配置
- `index.html`: Vite 入口 HTML
- `src/index.tsx`: 插件入口（已引入 `@bubblydoo/vite-uxp-plugin/runtime`）
- `public/icons/*`: 插件图标静态资源
