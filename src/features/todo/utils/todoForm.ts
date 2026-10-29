import type { TodoDetailResponse, TodoUpsertRequest } from "@/features/todo/types/todo";

/** Todo詳細Responseと登録・更新Requestの間で使用する画面編集フォーム。 */
export interface TodoDetailForm {
  todoId: number;
  dateFrom: string;
  dateTo: string;
  title: string;
  detail: string;
  /** 既存Todoの所有者ID。新規登録の0はBackendで認証アカウントIDへ解決される。 */
  userId: number;
  doneFlag: 0 | 1;
  priority: number;
  version: number;
}

/** Backendの文字列完了フラグを画面フォームの数値コードへ正規化する。 */
const toDoneFlag = (value: TodoDetailResponse["done_flag"] | undefined): 0 | 1 =>
  value === "1" ? 1 : 0;

/** Todo詳細APIのsnake_caseレスポンスを編集フォームへ変換する。 */
export const createTodoDetailForm = (detail: Partial<TodoDetailResponse> = {}): TodoDetailForm => ({
  todoId: detail.todo_id ?? 0,
  dateFrom: detail.date_from ?? "",
  dateTo: detail.date_to ?? "",
  title: detail.title ?? "",
  detail: detail.detail ?? "",
  userId: detail.user_id ?? 0,
  doneFlag: toDoneFlag(detail.done_flag),
  priority: detail.priority ?? 3,
  version: detail.version ?? 0,
});

/**
 * Todo編集フォームを登録・更新APIのsnake_caseリクエストへ変換する。
 * 旧数値roleを送信せず、BackendがHttpSessionのAuthenticatedUserからpermissionを判定する。
 */
export const buildTodoUpsertRequest = (form: TodoDetailForm): TodoUpsertRequest => ({
  todo_id: form.todoId,
  date_from: form.dateFrom,
  date_to: form.dateTo,
  title: form.title,
  detail: form.detail,
  done_flag: form.doneFlag === 1 ? "1" : "0",
  priority: form.priority,
  version: form.version,
  user_id: form.userId,
});

/** Todoの登録・更新の確認Dialogに並べる1項目。 */
export interface TodoConfirmItem {
  label: string;
  value: string;
}

const TODO_PRIORITY_LABELS: Readonly<Record<number, string>> = { 1: "低", 2: "中", 3: "高" };

/**
 * Todoの登録・更新の確認Dialog（`TodoUpsertConfirm.vue`）に並べる項目と値を、詳細画面と同じ見出しで組み立てる。
 * 値だけを並べると、完了フラグが「0」「1」と出て何の値か分からないため、表示用の文言へ変換する。
 *
 * @param form 確認するTodo編集フォーム
 * @returns 見出しと値の組（タイトル・着手日・期限日・重要度・完了フラグ・詳細の順）
 */
export const buildTodoConfirmItems = (form: TodoDetailForm): TodoConfirmItem[] => [
  { label: "タイトル", value: form.title },
  { label: "着手日", value: form.dateFrom },
  { label: "期限日", value: form.dateTo },
  { label: "重要度", value: TODO_PRIORITY_LABELS[form.priority] ?? String(form.priority) },
  { label: "完了フラグ", value: form.doneFlag === 1 ? "完了" : "未完了" },
  { label: "詳細", value: form.detail },
];
