import daisyui from "daisyui";

export default {
  content: [
    "./src/**/*.{js,jsx}",
    "./plugin/**/*.html",
    "./plugin/**/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Aptos", "Segoe UI", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [
    daisyui({
      include: [
        "rootscrolllock",
        "rootcolor",
        "rootscrollgutter",
        "svg",
        "scrollbar",
        "properties",
        "button",
        "loading",
        "toggle",
        "input",
        "select",
        "textarea",
        "card",
        "badge",
        "alert",
        "label",
        "fieldset",
        "join",
        "radius",
      ],
      logs: false,
      // This plugin form only selects built-in theme names; the branded palette
      // is applied by overriding daisyUI's `--color-*` tokens in src/styles.css.
      themes: ["dark --default"],
    }),
  ],
};
