import eslintJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import eslintPluginVue from "eslint-plugin-vue";
import globals from "globals";
import typescriptEslint from "typescript-eslint";

/**
 * ESLintの検査規則（flat config）。
 *
 * - JavaScript・TypeScript・Vueの推奨規則で、不具合につながる書き方を検出する。
 * - 見た目（改行・字下げ・引用符）はPrettierに任せ、ESLintの見た目の規則は`eslint-config-prettier`で止める。
 * - 型情報を使う規則は、検査が遅くなるため使わない。型の誤りは`npm run typecheck`（tsc・vue-tsc）で検出する。
 */
export default typescriptEslint.config(
  {
    ignores: [
      "dist/**",
      "dist-ssr/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "playwright/.auth/**",
      "auto-imports.d.ts",
      "components.d.ts",
    ],
  },
  eslintJs.configs.recommended,
  typescriptEslint.configs.recommended,
  eslintPluginVue.configs["flat/recommended"],
  {
    // `<script lang="ts">`をTypeScriptとして読む。
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: typescriptEslint.parser,
      },
    },
  },
  {
    // 画面のコードはブラウザーで動く。
    files: ["src/**/*.{ts,vue}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // 設定ファイル・Vitest・Playwrightは、Node.jsとブラウザー（happy-dom・page.evaluate）の両方の値を使う。
    files: ["*.{js,ts}", "test/**/*.{js,ts}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    rules: {
      // `_`で始まる名前は「使わないことを明示した値」とする（分割代入で特定の項目を除く等）。
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  eslintConfigPrettier
);
