/** Task検索結果の期限グループ。 */
export type TaskSearchDueGroup = "OVERDUE" | "TODAY" | "UPCOMING";

/** Backendへ送るTask横断検索条件。nullは絞り込みなしを表す。 */
export interface TaskSearchFilters {
  keyword: string;
  projectId: number | null;
  assigneeAccountId: number | null;
  statusCode: string | null;
  dueFrom: string | null;
  dueTo: string | null;
  priority: number | null;
}

/** Saved View取得時の検索条件。Backendで未指定のkeywordはnullとなる。 */
export interface TaskSearchSavedFilters
  extends Omit<TaskSearchFilters, "keyword"> {
  keyword: string | null;
}

/** Task検索結果でタイトル以外に表示できる列コード。 */
export type TaskSearchColumn =
  | "PROJECT"
  | "STATUS"
  | "ASSIGNEE"
  | "PRIORITY"
  | "START_DATE"
  | "DUE_DATE"
  | "PROGRESS"
  | "DETAIL";

/** Project横断Task検索の1件。 */
export interface TaskSearchItem {
  taskId: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  taskStatusId: number;
  statusCode: string;
  statusName: string;
  completed: boolean;
  title: string;
  detail: string;
  dateFrom: string;
  dueDate: string;
  dueGroup: TaskSearchDueGroup;
  remainingDays: number;
  assigneeAccountId: number;
  assigneeLoginId: string | null;
  assigneeDisplayName: string;
  priority: number;
  progressPercent: number;
  version: number;
}

/** Task横断検索APIのResponse。 */
export interface TaskSearchListResponse {
  businessDate: string;
  truncated: boolean;
  tasks: TaskSearchItem[];
}

/** Task検索で選択できるProject。 */
export interface TaskSearchProjectOption {
  projectId: number;
  projectKey: string;
  projectName: string;
}

/** Task検索対象に存在する担当者。 */
export interface TaskSearchAssigneeOption {
  accountId: number;
  loginId: string | null;
  displayName: string;
}

/** Task検索で選択できるBoard列状態。 */
export interface TaskSearchStatusOption {
  statusCode: string;
  statusName: string;
}

/** 認証主体の参照範囲で使用できるTask検索候補。 */
export interface TaskSearchOptionsResponse {
  projects: TaskSearchProjectOption[];
  assignees: TaskSearchAssigneeOption[];
  statuses: TaskSearchStatusOption[];
}

/** 本人用Task Saved Viewの登録Request。 */
export interface TaskSavedViewCreateRequest {
  name: string;
  filters: TaskSearchFilters;
  visibleColumns: TaskSearchColumn[];
}

/** 本人用Task Saved Viewの更新Request。 */
export interface TaskSavedViewUpdateRequest extends TaskSavedViewCreateRequest {
  version: number;
}

/** 本人所有のTask Saved View。 */
export interface TaskSavedView {
  savedViewId: number;
  name: string;
  filters: TaskSearchSavedFilters;
  visibleColumns: TaskSearchColumn[];
  updatedAt: string;
  version: number;
}
