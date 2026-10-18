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
  timeTracking: {
    currentLoadFailed: "現在Timerを取得できませんでした。",
    startFailed: "TaskのTimerを開始できませんでした。",
    stopFailed: "Timerを停止できませんでした。",
    cancelFailed: "Timerを取消できませんでした。",
    operationForbidden: "このTaskでTimerを操作する権限がありません。",
    resourceNotFound: "対象のProjectまたはTaskが見つかりません。",
    historyLoadFailed: "Timer履歴を取得できませんでした。",
    auditLoadFailed: "Task実績工数の変更履歴を取得できませんでした。",
    auditForbidden:
      "Task実績工数の変更履歴を参照する権限がありません。",
    conflict: {
      alreadyRunning:
        "別の画面またはタブでTimerが開始されています。現在Timerを再取得しました。",
      notRunning:
        "Timerはすでに停止または取消されています。現在状態を再取得しました。",
      version:
        "Timerが別の操作で更新されました。現在状態を再取得しました。",
      durationExceeded:
        "連続24時間を超えているため停止できません。Timerを取消し、正しい工数を手入力してください。",
      dailyLimitExceeded:
        "日別実績が1440分を超えるため停止できません。Timerを取消し、正しい工数を手入力してください。",
      changed:
        "Timerの状態が別の操作で変更されました。現在状態を再取得しました。",
    },
  },
} as const;

/** 固定文言catalog全体の型。 */
export type DisplayMessageCatalog = typeof DISPLAY_MESSAGES;
