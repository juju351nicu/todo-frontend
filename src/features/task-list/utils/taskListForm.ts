import type {
  TaskListDetailResponse,
  TaskListUpsertRequest,
} from "@/features/task-list/types/taskList";

/** Task詳細Responseと登録・更新Requestの間で使用する画面編集フォーム。 */
export interface TaskListDetailForm {
  taskId: number;
  dateFrom: string;
  dateTo: string;
  title: string;
  detail: string;
  /** 既存Taskの所有者ID。新規登録の0はBackendで認証アカウントIDへ解決される。 */
  userId: number;
  doneFlag: 0 | 1;
  priority: number;
  version: number;
}

/** Backendの文字列完了フラグを画面フォームの数値コードへ正規化する。 */
const toDoneFlag = (value: TaskListDetailResponse["done_flag"] | undefined): 0 | 1 =>
  value === "1" ? 1 : 0;

/** Task詳細APIのsnake_caseレスポンスを編集フォームへ変換する。 */
export const createTaskListDetailForm = (
  detail: Partial<TaskListDetailResponse> = {}
): TaskListDetailForm => ({
  taskId: detail.task_id ?? 0,
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
 * Task編集フォームを登録・更新APIのsnake_caseリクエストへ変換する。
 * 旧数値roleを送信せず、BackendがHttpSessionのAuthenticatedUserからpermissionを判定する。
 */
export const buildTaskListUpsertRequest = (form: TaskListDetailForm): TaskListUpsertRequest => ({
  task_id: form.taskId,
  date_from: form.dateFrom,
  date_to: form.dateTo,
  title: form.title,
  detail: form.detail,
  done_flag: form.doneFlag === 1 ? "1" : "0",
  priority: form.priority,
  version: form.version,
  user_id: form.userId,
});

/** Taskの登録・更新の確認Dialogに並べる1項目。 */
export interface TaskListConfirmItem {
  label: string;
  value: string;
}

const TASK_LIST_PRIORITY_LABELS: Readonly<Record<number, string>> = { 1: "低", 2: "中", 3: "高" };

/**
 * Taskの登録・更新の確認Dialog（`TaskListUpsertConfirm.vue`）に並べる項目と値を、詳細画面と同じ見出しで組み立てる。
 * 値だけを並べると、完了フラグが「0」「1」と出て何の値か分からないため、表示用の文言へ変換する。
 *
 * @param form 確認するTask編集フォーム
 * @returns 見出しと値の組（タイトル・着手日・期限日・重要度・完了フラグ・詳細の順）
 */
export const buildTaskListConfirmItems = (form: TaskListDetailForm): TaskListConfirmItem[] => [
  { label: "タイトル", value: form.title },
  { label: "着手日", value: form.dateFrom },
  { label: "期限日", value: form.dateTo },
  { label: "重要度", value: TASK_LIST_PRIORITY_LABELS[form.priority] ?? String(form.priority) },
  { label: "完了フラグ", value: form.doneFlag === 1 ? "完了" : "未完了" },
  { label: "詳細", value: form.detail },
];
