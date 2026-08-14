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

/** Project内Taskの優先度。数字が小さいほど優先度が高い。 */
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
