/** Task一覧API（`/api/v1/task-list/*`）のRequest・Response。項目名はBackendのJSONに合わせてsnake_caseを含む。 */

/** Task一覧・カレンダー検索APIリクエスト。Backendが認証主体から参照範囲を決定する。 */
export interface TaskListSearchRequest {
  search_title: string;
  date_range: string;
  done_flag_values: number[];
}

/** Task一覧とカレンダーが共有する、認可済みTask情報。 */
export interface TaskListItem {
  taskId: number;
  title: string;
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

/** Task一覧・カレンダーAPIレスポンス。カレンダーでは祝日のEventも含む。 */
export interface TaskListSearchResponse {
  taskList: TaskListItem[];
}

/**
 * Task登録・更新APIリクエスト（snake_case）。
 * `user_id`は全件更新permission利用者の割当候補であり、本人更新permissionではBackendが無視する。
 */
export interface TaskListUpsertRequest {
  task_id: number;
  /** 着手日。`YYYY-MM-DD`。 */
  date_from: string;
  /** 期限日。`YYYY-MM-DD`。 */
  date_to: string;
  title: string;
  detail: string;
  done_flag: "0" | "1";
  user_id: number;
  priority: number;
  version: number;
}

/** Task詳細APIのsnake_caseレスポンス。登録・更新リクエストの項目に、表示専用の担当者名を足したもの。 */
export interface TaskListDetailResponse extends TaskListUpsertRequest {
  /** 担当者の「姓 名」。会員情報に姓・名がない場合はnull（画面はユーザーIDで示す）。 */
  owner_name: string | null;
}
