/**
 * Nuxt UI Componentの`color` propへ渡すsemantic color名。
 * 実際の色は`src/app/theme/nuxtUiTheme.ts`の`colors`で決める。
 */
export type SemanticColor = "primary" | "secondary" | "success" | "info" | "warning" | "error" | "neutral";

/** 成功・情報・警告・エラーの通知種別。`StatusAlert`の`type`と、同じ名前のsemantic colorに対応する。 */
export type StatusAlertType = "success" | "info" | "warning" | "error";
