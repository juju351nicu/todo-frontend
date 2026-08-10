import type {
  AccountRole,
  MemberListItem,
} from "@/features/member/types/member";
import type {
  TodoDetailResponse,
  TodoUpsertRequest,
} from "@/features/task/types/task";

export interface TodoDetailForm {
  todoId: number;
  dateFrom: string;
  dateTo: string;
  title: string;
  detail: string;
  userId: number;
  doneFlag: 0 | 1;
  priority: number;
  version: number;
  idMemberMap: Record<string, MemberListItem>;
  userList: MemberListItem[];
}

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
  userId: detail.user_id ?? 1,
  doneFlag: toDoneFlag(detail.done_flag),
  priority: detail.priority ?? 3,
  version: detail.version ?? 0,
  idMemberMap: {},
  userList: [],
});

/** Todo編集フォームを登録・更新APIのsnake_caseリクエストへ変換する。 */
export const buildTodoUpsertRequest = (
  form: TodoDetailForm,
  role: AccountRole
): TodoUpsertRequest => ({
  todo_id: form.todoId,
  date_from: form.dateFrom,
  date_to: form.dateTo,
  title: form.title,
  detail: form.detail,
  done_flag: form.doneFlag === 1 ? "1" : "0",
  role,
  priority: form.priority,
  version: form.version,
  user_id: form.userId,
});
