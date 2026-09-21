import type {
  ProjectDetail,
  ProjectRole,
  TaskPriority,
} from "@/features/project/types/project";

/** Project Templateへ保存するWBS Task種別。 */
export type ProjectTemplateTaskType = "SUMMARY" | "TASK" | "MILESTONE";

/** Project Templateが対応するTask依存種別。 */
export type ProjectTemplateDependencyType = "FINISH_TO_START";

/** Project生成時にACTIVE accountへ割り当てるmember slot。 */
export interface ProjectTemplateMemberSlot {
  slotKey: string;
  displayName: string;
  projectRole: ProjectRole;
  position: number;
}

/** Project Templateへ保存したBoard列snapshot。 */
export interface ProjectTemplateStatus {
  statusCode: string;
  name: string;
  position: number;
  completed: boolean;
}

/** Project Template内Taskへ保存したchecklist項目。 */
export interface ProjectTemplateChecklistItem {
  content: string;
  position: number;
}

/** Board配置とWBS階層を含むProject Template内Task snapshot。 */
export interface ProjectTemplateTask {
  projectTemplateTaskId: number;
  parentProjectTemplateTaskId: number | null;
  assigneeSlotKey: string;
  statusCode: string;
  taskType: ProjectTemplateTaskType;
  wbsCode: string | null;
  title: string;
  detail: string;
  priority: TaskPriority;
  plannedEffortMinutes: number;
  startOffsetDays: number;
  dueOffsetDays: number;
  position: number;
  checklistItems: ProjectTemplateChecklistItem[];
}

/** Project Template内Task snapshot同士の依存関係。 */
export interface ProjectTemplateDependency {
  projectTemplateDependencyId: number;
  predecessorProjectTemplateTaskId: number;
  successorProjectTemplateTaskId: number;
  dependencyType: ProjectTemplateDependencyType;
  lagMinutes: number;
}

/** 本人所有Project Template一覧に表示する軽量header。 */
export interface ProjectTemplateSummary {
  projectTemplateId: number;
  name: string;
  description: string | null;
  baseDate: string;
  sourceProjectId: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** member slot、Board列、Task、依存を含むProject Template詳細。 */
export interface ProjectTemplate extends ProjectTemplateSummary {
  memberSlots: ProjectTemplateMemberSlot[];
  statuses: ProjectTemplateStatus[];
  tasks: ProjectTemplateTask[];
  dependencies: ProjectTemplateDependency[];
}

/** ACTIVE Projectを本人所有Project Templateへ保存するRequest。 */
export interface ProjectTemplateCaptureRequest {
  name: string;
  baseDate: string;
}

/** 本人所有Project Templateの変更可能なheaderを更新するRequest。 */
export interface ProjectTemplateUpdateRequest {
  name: string;
  description: string | null;
  version: number;
}

/** Project Templateのmember slotを生成先accountへ割り当てるRequest要素。 */
export interface ProjectTemplateMemberMappingRequest {
  slotKey: string;
  accountId: number;
}

/** Project Templateから通常Project全体を生成するRequest。 */
export interface ProjectTemplateApplyRequest {
  projectKey: string;
  name: string;
  projectStartDate: string;
  memberMappings: ProjectTemplateMemberMappingRequest[];
}

/** Project Template適用APIが返す生成済みProject詳細。 */
export type ProjectTemplateApplyResponse = ProjectDetail;
