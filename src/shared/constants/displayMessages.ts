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
  attendance: {
    self: {
      forbidden: "本人勤怠を操作するpermissionがありません。",
      accountNotFound: "勤怠対象のアカウントが見つかりません。",
      punchFailed: "打刻を確定できませんでした。",
      submitMonthFailed: "月次勤怠を提出できませんでした。",
      correctionRequestFailed: "勤怠修正を申請できませんでした。",
      correctionCancelFailed: "勤怠修正申請を取り消せませんでした。",
      loadFailed: "勤怠情報を取得できませんでした。",
      monthRefreshFailed: "月間勤怠を更新できませんでした。",
      dayLoadFailed: "選択日の勤怠を取得できませんでした。",
    },
    administration: {
      forbidden: "勤怠月を参照または更新するpermissionがありません。",
      resourceNotFound: "対象のアカウントまたは勤怠月が見つかりません。",
      correctionCurrentLoadFailed:
        "修正対象の現在勤怠を取得できませんでした。",
      monthListLoadFailed: "勤怠月一覧を取得できませんでした。",
      correctionListLoadFailed: "勤怠修正申請一覧を取得できませんでした。",
      monthDetailLoadFailed: "勤怠月詳細を取得できませんでした。",
      monthUpdateFailed: "勤怠月の状態を更新できませんでした。",
      correctionReviewFailed: "勤怠修正申請を審査できませんでした。",
      exportForbidden: "月次勤怠CSVを出力するpermissionがありません。",
      exportFailed: "月次勤怠CSVを出力できませんでした。",
    },
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
