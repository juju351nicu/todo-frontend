import type { AccountRole, MemberListItem } from "@/types/member";

/** Todo一覧・カレンダー検索APIリクエスト。 */
export interface TodoListRequest {
  search_title: string;
  date_range: string;
  done_flag_values: number[];
}

/** Todo一覧とカレンダーが共有するTodo情報。 */
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

/** Todo一覧・カレンダーAPIレスポンス。 */
export interface TodoListResponse {
  errorMessages: string[] | null;
  user: MemberListItem | null;
  message: string | null;
  role: AccountRole;
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

/** Todo登録・更新APIリクエスト。 */
export interface TodoUpsertRequest extends TodoDetailResponse {
  role?: AccountRole | null;
}

/** Todo登録・更新APIレスポンス。 */
export interface TodoUpsertResponse extends TodoUpsertRequest {
  id_member_map?: Record<string, MemberListItem> | null;
  user_list?: MemberListItem[] | null;
}
