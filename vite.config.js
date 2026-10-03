import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { configDefaults } from "vitest/config";
import { fileURLToPath, URL } from "node:url";
// https://vitejs.dev/config/
export default defineConfig({
  build: {
    // MIT版DHTMLX Ganttは約622KBだが選択時だけ遅延読込するため、650KBまでは許容する。
    chunkSizeWarningLimit: 650,
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
  plugins: [vue(), vuetify()],
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
