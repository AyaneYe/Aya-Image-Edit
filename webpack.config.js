/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import path, { resolve } from "path";
import CopyWebpackPlugin from "copy-webpack-plugin";
import webpack from "webpack";

const sharedRules = [
  {
    test: /\.(js|jsx)$/,
    exclude: /node_modules/,
    use: {
      loader: "babel-loader",
    },
  },
  {
    test: /\.css$/,
    use: ["style-loader", "css-loader", "postcss-loader"],
  },
];

export default (env, argv = {}) => {
  const mode = argv.mode || "development";
  const devtool = mode === "development" ? "source-map" : false;

  const shared = {
    devtool,
    mode,
    output: {
      path: resolve("dist"),
    },
    module: {
      rules: sharedRules,
    },
    resolve: {
      extensions: [".js", ".jsx", ".json"],
    },
  };

  const staticPluginFiles = new CopyWebpackPlugin({
    patterns: [
      { from: "manifest.json", to: "manifest.json" },
      { from: "plugin/index.html", to: "index.html" },
      { from: "plugin/app.html", to: "app.html" },
      { from: "plugin/app-shell.js", to: "app-shell.js" },
      { from: "plugin/icons", to: "icons", noErrorOnMissing: true },
      { from: "plugin/presets", to: "presets", noErrorOnMissing: true },
    ],
  });

  const hostConfig = {
    ...shared,
    name: "host",
    entry: resolve("plugin/host/index.jsx"),
    output: {
      ...shared.output,
      filename: "host.js",
    },
    externals: {
      uxp: "commonjs2 uxp",
      photoshop: "commonjs2 photoshop",
      os: "commonjs2 os",
    },
    plugins: [
      staticPluginFiles,
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  };

  const appConfig = {
    ...shared,
    name: "app",
    entry: resolve("src/appWebView.jsx"),
    output: {
      ...shared.output,
      filename: "app.js",
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],
  };

  return [hostConfig, appConfig];
};
