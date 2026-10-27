import type { AccountStatus } from "@/shared/types/accountStatus";

/** Projectの利用状態。 */
export type ProjectStatus = "ACTIVE" | "ARCHIVED";

/** Project内でTaskやメンバーを操作するときに使用するロール。 */
export type ProjectRole = "OWNER" | "MANAGER" | "MEMBER";

/** Project一覧に表示する概要情報。 */
export interface ProjectSummary {
  projectId: number;
  projectKey: string;
  name: string;
  status: ProjectStatus;
  projectRole: ProjectRole | null;
  version: number;
}

/** Project一覧APIのResponse。 */
export interface ProjectListResponse {
  projects: ProjectSummary[];
}

/** Projectへ参加しているアカウントとProject内ロール。 */
export interface ProjectMember {
  accountId: number;
  projectRole: ProjectRole;
  joinedAt: string;
  assignedBy: number;
  version: number;
  /** 画面へ表示する参加者名。Backendが「姓 名」→メールアドレス→「Account {ID}」の順で必ず空でない値にする。 */
  displayName: string;
  /** 参加アカウントの状態。ACTIVE以外は日別予定・日別実績・繰り返しTask等の担当者に指定できない。 */
  accountStatus: AccountStatus;
}

/** Boardの列として使用するTask status。 */
export interface TaskStatus {
  taskStatusId: number;
  statusCode: string;
  name: string;
  position: number;
  completed: boolean;
  version: number;
}

/** Project詳細APIのResponse。 */
export interface ProjectDetail {
  projectId: number;
  projectKey: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  version: number;
  members: ProjectMember[];
  taskStatuses: TaskStatus[];
}

/** Projectの表示情報または状態を現在version付きで更新するRequest。 */
export interface ProjectUpdateRequest {
  name: string;
  description: string | null;
  status: ProjectStatus;
  version: number;
}

/** 有効なアカウントをProject memberとして追加するRequest。 */
export interface ProjectMemberCreateRequest {
  accountId: number;
  projectRole: ProjectRole;
}

/** Project memberのresource roleを現在version付きで変更するRequest。 */
export interface ProjectMemberUpdateRequest {
  projectRole: ProjectRole;
  version: number;
}

/**
 * WBS上のTask構造種別（Backendの`TaskType`コード）。
 * 実績工数とTimerは`TASK`だけが対象で、`SUMMARY`・`MILESTONE`ではBackendが400で拒否する。
 */
export type TaskType = "TASK" | "SUMMARY" | "MILESTONE";

/** Project内Taskの優先度。1=低、2=中、3=高。 */
export type TaskPriority = 1 | 2 | 3;

/** Board上のTaskカード。 */
export interface TaskCard {
  taskId: number;
  title: string;
  detail: string;
  dateFrom: string;
  dateTo: string;
  assigneeAccountId: number;
  priority: TaskPriority;
  /**
   * WBS上のTask種別。Backendが返さない古い版では、API境界（`projectApi`・`projectTaskApi`）で`TASK`を補う。
   */
  taskType: TaskType;
  position: number;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Boardの1列と、その列に現在所属するTask。 */
export interface TaskBoardColumn extends TaskStatus {
  tasks: TaskCard[];
}

/** Project Board取得APIのResponse。 */
export interface TaskBoard {
  projectId: number;
  projectName: string;
  columns: TaskBoardColumn[];
}

/** Task詳細APIのResponse。 */
export interface TaskDetail extends TaskCard {
  projectId: number;
  taskStatusId: number;
  archived: boolean;
}

/** Task新規登録APIへ送信する値。 */
export interface TaskCreateRequest {
  title: string;
  detail: string;
  dateFrom: string;
  dateTo: string;
  assigneeAccountId: number;
  taskStatusId: number;
  priority: TaskPriority;
}

/** Task更新APIへ送信する値。列移動は専用APIを使用する。 */
export interface TaskUpdateRequest {
  title: string;
  detail: string;
  dateFrom: string;
  dateTo: string;
  assigneeAccountId: number;
  priority: TaskPriority;
  version: number;
}

/** Task移動APIへ送信する移動先列、隣接Task、楽観ロックversion。 */
export interface TaskMoveRequest {
  destinationStatusId: number;
  previousTaskId: number | null;
  nextTaskId: number | null;
  version: number;
}
