import type {
  MemberListItem,
} from "@/features/member/types/member";
import type { TodoDetailResponse } from "@/types/todo";

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
