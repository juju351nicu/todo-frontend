import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import ui from "@nuxt/ui/vite";
import vuetify from "vite-plugin-vuetify";
import { configDefaults } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

import { nuxtUiTheme, themeColors } from "./src/app/theme/nuxtUiTheme";
// https://vitejs.dev/config/
export default defineConfig({
  build: {
    // MIT版DHTMLX Ganttは約622KBだが選択時だけ遅延読込するため、650KBまでは許容する。
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Nuxt UIの共有chunkがVueのruntime初期化を別chunkへ置くと、遅延読込routeの初回表示で
              // `init_runtime_dom_esm_bundler is not defined`となる（rolldown 1.0.3で確認）。
              // UI基盤とVue本体を同じchunkへまとめ、初期化順を保証する。
              name: "vendor-ui",
              test: /node_modules[\\/](vue|@vue|@vueuse|vue-router|pinia|@nuxt[\\/]ui|reka-ui|@floating-ui|@internationalized|tailwind-variants|@iconify|@tanstack[\\/](vue|table))/,
            },
          ],
        },
      },
    },
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    host: "localhost",
    port: 8081,
  },
  plugins: [
    vue(),
    vuetify(),
    ui({
      ui: nuxtUiTheme,
      theme: {
        colors: [...themeColors],
      },
      // Vuetifyの既定どおりlight表示に固定し、OSのdark mode設定で配色を変えない。
      colorMode: false,
      icon: {
        // 画面のMDIアイコンをbuildへ同梱し、実行時にIconify APIへ通信しない。
        clientBundle: {
          scan: {
            globInclude: ["src/**/*.{vue,ts}"],
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Playwright suiteをVitestへ誤収集させず、各runnerの責務とfixture lifecycleを分離する。
    exclude: [...configDefaults.exclude, "test/e2e/**"],
  },
});
