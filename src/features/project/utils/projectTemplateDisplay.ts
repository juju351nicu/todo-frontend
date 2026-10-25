import type { ProjectTemplateTask, ProjectTemplateTaskType } from "@/features/project/types/projectTemplate";

const TASK_TYPE_LABELS: Readonly<Record<ProjectTemplateTaskType, string>> = {
  SUMMARY: "Summary",
  TASK: "Task",
  MILESTONE: "Milestone",
};

const PRIORITY_LABELS: Readonly<Record<ProjectTemplateTask["priority"], string>> = {
  1: "低",
  2: "中",
  3: "高",
};

/** Template TaskのTask種別コードを画面表示へ変換する。 */
export const getProjectTemplateTaskTypeLabel = (taskType: ProjectTemplateTaskType): string =>
  TASK_TYPE_LABELS[taskType];

/** Template Taskの優先度コード（1:低、2:中、3:高）を日本語表示へ変換する。 */
export const getProjectTemplatePriorityLabel = (priority: ProjectTemplateTask["priority"]): string =>
  PRIORITY_LABELS[priority];

/**
 * Templateの基準日からの符号付き日数を表示へ変換する。
 *
 * @param offsetDays 基準日からの日数。負値は基準日より前
 * @returns `基準日`、`+3日`、`-2日`のいずれかの形式
 */
export const formatProjectTemplateOffset = (offsetDays: number): string => {
  if (offsetDays === 0) {
    return "基準日";
  }
  return offsetDays > 0 ? `+${offsetDays}日` : `${offsetDays}日`;
};

/**
 * 依存関係一覧に表示するTask名を、snapshot内のTask IDから求める。
 *
 * @param tasks 選択中TemplateのTask snapshot
 * @param taskId 依存関係が参照するsnapshot Task ID
 * @returns WBS codeがあれば先頭に付けたTask名。snapshot内に見つからない場合は`ID: <taskId>`
 */
export const formatProjectTemplateTaskTitle = (tasks: readonly ProjectTemplateTask[], taskId: number): string => {
  const task = tasks.find((candidate) => candidate.projectTemplateTaskId === taskId);
  if (!task) {
    return `ID: ${taskId}`;
  }
  return task.wbsCode ? `${task.wbsCode} ${task.title}` : task.title;
};
