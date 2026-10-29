import type {
  ProjectTemplateMemberSlot,
  ProjectTemplateStatus,
  ProjectTemplateTask,
  ProjectTemplateTaskType,
} from "@/features/project/types/projectTemplate";

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
export const getProjectTemplatePriorityLabel = (
  priority: ProjectTemplateTask["priority"]
): string => PRIORITY_LABELS[priority];

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
export const formatProjectTemplateTaskTitle = (
  tasks: readonly ProjectTemplateTask[],
  taskId: number
): string => {
  const task = tasks.find((candidate) => candidate.projectTemplateTaskId === taskId);
  if (!task) {
    return `ID: ${taskId}`;
  }
  return task.wbsCode ? `${task.wbsCode} ${task.title}` : task.title;
};

/**
 * Template TaskのBoard列コード（`TODO`等）を、Templateに保存した列名で示す（利用者はコードを知らないため）。
 *
 * @param statusCode Template TaskのBoard列コード
 * @param statuses Templateに保存したBoard列
 * @returns 列名。対応する列がなければコード自体
 */
export const resolveProjectTemplateStatusName = (
  statusCode: string,
  statuses: readonly ProjectTemplateStatus[]
): string => statuses.find((status) => status.statusCode === statusCode)?.name ?? statusCode;

/**
 * Template Taskの担当slotのキー（`OWNER_1`等）を、slotの表示名で示す。
 *
 * @param slotKey Template Taskの担当slotのキー
 * @param memberSlots Templateに保存したmember slot
 * @returns slotの表示名。対応するslotがなければキー自体
 */
export const resolveProjectTemplateSlotName = (
  slotKey: string,
  memberSlots: readonly ProjectTemplateMemberSlot[]
): string => memberSlots.find((slot) => slot.slotKey === slotKey)?.displayName ?? slotKey;

/**
 * Template Taskの親を、snapshot IDではなく親TaskのWBS番号と件名で示す。
 *
 * @param parentProjectTemplateTaskId 親のsnapshot Task ID。最上位はnull
 * @param tasks 同じTemplateのTask
 * @returns 例 `親: 1 設計`。最上位、または親が見つからない場合は空文字
 */
export const formatProjectTemplateParent = (
  parentProjectTemplateTaskId: number | null,
  tasks: readonly ProjectTemplateTask[]
): string => {
  if (parentProjectTemplateTaskId === null) {
    return "";
  }
  const parent = tasks.find((task) => task.projectTemplateTaskId === parentProjectTemplateTaskId);
  return parent === undefined
    ? ""
    : `親: ${[parent.wbsCode, parent.title].filter(Boolean).join(" ")}`;
};
