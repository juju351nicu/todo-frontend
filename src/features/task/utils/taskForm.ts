import type {
  TodoDetailResponse,
  TodoUpsertRequest,
} from "@/features/task/types/task";

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
const toDoneFlag = (
  value: TodoDetailResponse["done_flag"] | undefined
): 0 | 1 => (value === "1" ? 1 : 0);

/** Todo詳細APIのsnake_caseレスポンスを編集フォームへ変換する。 */
export const createTodoDetailForm = (
  detail: Partial<TodoDetailResponse> = {}
): TodoDetailForm => ({
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
export const buildTodoUpsertRequest = (
  form: TodoDetailForm
): TodoUpsertRequest => ({
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
