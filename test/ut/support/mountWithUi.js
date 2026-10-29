import ui from "@nuxt/ui/vue-plugin";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";

/**
 * Nuxt UIの部品を含む`.vue`を、happy-domの上でアプリと同じplugin（Nuxt UI・Pinia）付きでmountする。
 *
 * 使うテストファイルの先頭に`// @vitest-environment happy-dom`を書く（ほかのテストはnode環境のまま）。
 * Nuxt UIの部品はVite pluginの自動importで解決されるため、ここでは登録しない。
 *
 * @param component テストする部品
 * @param options `@vue/test-utils`の`mount`へ渡す設定（props・slots等）。`global.plugins`は足される
 * @returns mountした部品のwrapper
 */
export const mountWithUi = (component, options = {}) =>
  mount(component, {
    ...options,
    attachTo: document.body,
    global: {
      ...options.global,
      plugins: [...(options.global?.plugins ?? []), ui, createPinia()],
    },
  });
