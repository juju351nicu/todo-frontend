import type { TaskPriority } from "@/features/project/types/project";

/** 繰り返しTaskの発生頻度。 */
export type TaskRecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

/** 週次規則で選択できる曜日。 */
export type TaskRecurrenceWeekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** 繰り返し規則のlifecycle状態。 */
export type TaskRecurrenceStatus =
  | "ACTIVE"
  | "PAUSED"
  | "BLOCKED"
  | "ENDED"
  | "ARCHIVED";

/** 発生日単位のTask生成状態。 */
export type TaskRecurrenceGenerationStatus =
  | "PENDING"
  | "PROCESSING"
  | "RETRY_WAIT"
  | "SUCCEEDED"
  | "FAILED"
  | "SKIPPED";

/** 規則に固定されたchecklist snapshot。 */
export interface TaskRecurrenceChecklistItem {
  content: string;
  position: number;
}

/** Projectに属する繰り返しTask規則。 */
export interface TaskRecurrence {
  taskRecurrenceRuleId: number;
  projectId: number;
  ownerAccountId: number;
  title: string;
  detail: string;
  priority: TaskPriority;
  plannedEffortMinutes: number;
  dueOffsetDays: number;
  assigneeAccountId: number;
  taskStatusId: number;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  weekdays: TaskRecurrenceWeekday[];
  monthlyDay: number | null;
  firstOccurrenceDate: string;
  nextOccurrenceDate: string | null;
  endDate: string | null;
  generationLeadDays: number;
  status: TaskRecurrenceStatus;
  blockedReason: string | null;
  sourceTaskTemplateId: number | null;
  checklistItems: TaskRecurrenceChecklistItem[];
  createdAt: string;
  updatedAt: string;
  /** 更新・archive・生成再試行へ渡す取得時点の楽観ロックversion。 */
  version: number;
}

/** 直接作成と更新で共通するTask snapshotとschedule。 */
export interface TaskRecurrenceSnapshotRequest {
  title: string;
  detail: string;
  priority: TaskPriority;
  plannedEffortMinutes: number;
  dueOffsetDays: number;
  assigneeAccountId: number;
  taskStatusId: number;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  weekdays: TaskRecurrenceWeekday[];
  monthlyDay: number | null;
  endDate: string | null;
  generationLeadDays: number;
  checklistItems: Array<{ content: string }>;
}

/** Task snapshotを直接指定する繰り返し規則作成Request。 */
export interface TaskRecurrenceCreateRequest
  extends TaskRecurrenceSnapshotRequest {
  firstOccurrenceDate: string;
}

/** 本人所有Task Templateから繰り返し規則を作成するRequest。 */
export interface TaskRecurrenceFromTemplateRequest {
  taskTemplateId: number;
  assigneeAccountId: number | null;
  taskStatusId: number | null;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  weekdays: TaskRecurrenceWeekday[];
  monthlyDay: number | null;
  firstOccurrenceDate: string;
  endDate: string | null;
  generationLeadDays: number;
}

/** 未生成Task snapshot、schedule、pause状態の全置換Request。 */
export interface TaskRecurrenceUpdateRequest
  extends TaskRecurrenceSnapshotRequest {
  status: "ACTIVE" | "PAUSED";
  version: number;
}

/** 発生日単位の繰り返しTask生成結果。 */
export interface TaskRecurrenceGeneration {
  taskRecurrenceGenerationId: number;
  taskRecurrenceRuleId: number;
  occurrenceDate: string;
  status: TaskRecurrenceGenerationStatus;
  generatedProjectId: number | null;
  generatedTaskId: number | null;
  attemptCount: number;
  nextRetryAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
}
