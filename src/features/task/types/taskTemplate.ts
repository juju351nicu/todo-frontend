import type {
  TaskDetail,
  TaskPriority,
} from "@/features/project/types/project";

/** Task Templateに保存されたchecklist snapshot。 */
export interface TaskTemplateChecklistItem {
  content: string;
  position: number;
}

/** 本人所有Task Templateのsnapshot。 */
export interface TaskTemplate {
  taskTemplateId: number;
  name: string;
  title: string;
  detail: string;
  priority: TaskPriority;
  dueOffsetDays: number;
  plannedEffortMinutes: number;
  defaultStatusCode: string;
  defaultAssigneeAccountId: number | null;
  sourceProjectId: number | null;
  sourceTaskId: number | null;
  checklistItems: TaskTemplateChecklistItem[];
  createdAt: string;
  updatedAt: string;
  /** 更新・archiveへ渡す取得時点の楽観ロックversion。 */
  version: number;
}

/** 既存Taskを本人用Templateとして保存するRequest。 */
export interface TaskTemplateCaptureRequest {
  name: string;
}

/** 本人所有Task Template snapshotの全置換Request。 */
export interface TaskTemplateUpdateRequest {
  name: string;
  title: string;
  detail: string;
  priority: TaskPriority;
  dueOffsetDays: number;
  plannedEffortMinutes: number;
  defaultStatusCode: string;
  defaultAssigneeAccountId: number | null;
  checklistItems: Array<{ content: string }>;
  version: number;
}

/** TemplateからProjectへ通常Taskを生成するRequest。 */
export interface TaskTemplateApplyRequest {
  taskTemplateId: number;
  dateFrom: string | null;
  assigneeAccountId: number | null;
  taskStatusId: number | null;
}

/** Task Template適用APIが返す作成済みTask。 */
export type TaskTemplateApplyResponse = TaskDetail;
