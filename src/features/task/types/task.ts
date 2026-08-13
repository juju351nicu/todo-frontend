/** Todo一覧・カレンダー検索APIリクエスト。Backendが認証主体から参照範囲を決定する。 */
export interface TodoListRequest {
  search_title: string;
  date_range: string;
  done_flag_values: number[];
}

/** Todo一覧とカレンダーが共有する、認可済みTodo情報。 */
export interface TodoListItem {
  todoId: number;
  title: string;
  description: string | null;
  start: string;
  end: string;
  color: string | null;
  url: string | null;
  display: string | null;
  detail: string;
  doneFlag: boolean;
  userId: number;
  remainingDays: number;
  firstName: string | null;
  lastName: string | null;
  priority: number;
}

/** Todo一覧・カレンダーAPIレスポンス。旧role・会員情報は認可判断へ使用しない。 */
export interface TodoListResponse {
  errorMessages: string[] | null;
  message: string | null;
  todoList: TodoListItem[];
}

/** Todo詳細APIのsnake_caseレスポンス。 */
export interface TodoDetailResponse {
  todo_id: number;
  date_from: string;
  date_to: string;
  title: string;
  detail: string;
  done_flag: "0" | "1";
  user_id: number;
  priority: number;
  version: number;
}

/**
 * Todo登録・更新APIリクエスト。
 * `user_id`は全件更新permission利用者の割当候補であり、本人更新permissionではBackendが無視する。
 */
export type TodoUpsertRequest = TodoDetailResponse;
