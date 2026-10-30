/**
 * アカウント画面（アカウント一覧・アカウント登録・アカウント設定・退会）で出す文言。
 *
 * アカウントAPIのエラー本文は機能ごとのerror codeを持たないため、画面が操作とHTTP statusから文言を選ぶ。
 * 401は文言を出さずログイン画面へ戻す（`useSessionExpiry`）。
 */
export const ACCOUNT_MESSAGES = {
  listLoadFailed: "アカウント一覧を取得できませんでした。時間をおいて再読み込みしてください。",
  deleteFailed: "選択したアカウントを削除できませんでした。",
  deleteForbidden: "アカウントを削除する権限がありません。",
  detailLoadFailed: "アカウント情報を取得できませんでした。アカウント一覧から開き直してください。",
  saveFailed: "アカウント情報を保存できませんでした。入力内容を確認してください。",
  saveForbidden: "このアカウント情報を変更する権限がありません。",
  cancelFailed: "退会処理に失敗しました。入力内容を確認してください。",
} as const;
