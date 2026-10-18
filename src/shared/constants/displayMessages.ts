/**
 * FrontendがBackend本文なしでも表示できる固定文言catalog。
 * Backendのmessageは表示専用とし、画面分岐にはHTTP statusとerror codeを使用する。
 */
export const DISPLAY_MESSAGES = {
  common: {
    connectionFailed: "Backendへ接続できませんでした。",
    requestFailed:
      "処理を完了できませんでした。しばらくしてから再度お試しください。",
  },
  dashboard: {
    loadFailed: "Dashboardを取得できませんでした。",
    advancedConnectionFailed: "高度Dashboardへ接続できませんでした。",
    advancedLoadFailed: "高度Dashboardを取得できませんでした。",
  },
} as const;

/** 固定文言catalog全体の型。 */
export type DisplayMessageCatalog = typeof DISPLAY_MESSAGES;
