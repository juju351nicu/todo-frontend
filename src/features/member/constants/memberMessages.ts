/**
 * 旧会員画面（会員一覧・詳細・登録・退会）で出す文言。
 *
 * 会員APIのエラー本文は機能ごとのerror codeを持たないため、画面が操作とHTTP statusから文言を選ぶ。
 * 401は文言を出さずログイン画面へ戻す（`useSessionExpiry`）。
 */
export const MEMBER_MESSAGES = {
  listLoadFailed:
    "会員一覧を取得できませんでした。時間をおいて再読み込みしてください。",
  deleteFailed: "選択した会員を削除できませんでした。",
  deleteForbidden: "会員を削除する権限がありません。",
  detailLoadFailed:
    "会員情報を取得できませんでした。会員一覧から開き直してください。",
  saveFailed: "会員情報を保存できませんでした。入力内容を確認してください。",
  saveForbidden: "この会員情報を変更する権限がありません。",
  cancelFailed: "退会処理に失敗しました。入力内容を確認してください。",
} as const;
