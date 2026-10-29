import type { TaskPriority } from "@/features/project/types/project";

/** BackendがAsia/Tokyoの業務日を基準に決定するMy Tasks期限グループ。 */
export type MyTaskDueGroup = "OVERDUE" | "TODAY" | "UPCOMING";

/** My Tasks専用APIが返す、本人担当の未完了Project Task。 */
export interface MyTaskItem {
  taskId: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  taskStatusId: number;
  statusCode: string;
  statusName: string;
  title: string;
  detail: string;
  dateFrom: string;
  dueDate: string;
  dueGroup: MyTaskDueGroup;
  remainingDays: number;
  /** 優先度（1:低、2:中、3:高）。BackendのTaskPriority。 */
  priority: TaskPriority;
  progressPercent: number;
  version: number;
}

/** My Tasks専用APIの一覧Response。 */
export interface MyTaskListResponse {
  businessDate: string;
  tasks: MyTaskItem[];
}
