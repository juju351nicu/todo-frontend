import type {
  WbsParentOption,
  WbsTask,
  WbsTaskEditForm,
  WbsTaskUpdateRequest,
} from "@/features/wbs/types/wbs";
import { buildWbsTreeRows } from "@/features/wbs/utils/wbsTree";

const ISO_LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** APIのWBS Taskを、元Responseを変更しない編集フォームへ変換する。 */
export const buildWbsTaskEditForm = (task: WbsTask): WbsTaskEditForm => ({
  parentTaskId: task.parentTaskId,
  taskType: task.taskType,
  wbsCode: task.wbsCode ?? "",
  plannedStartDate: task.plannedStartDate,
  plannedEndDate: task.plannedEndDate,
  plannedEffortMinutes: task.plannedEffortMinutes,
  progressPercent: task.progressPercent,
  version: task.version,
});

/** 指定Taskの全子孫IDを、循環した入力でも停止するよう反復処理で収集する。 */
const collectDescendantTaskIds = (
  tasks: readonly WbsTask[],
  taskId: number
): Set<number> => {
  const childIdsByParentId = new Map<number, number[]>();
  tasks.forEach((task) => {
    if (task.parentTaskId === null) {
      return;
    }
    const childIds = childIdsByParentId.get(task.parentTaskId) ?? [];
    childIds.push(task.taskId);
    childIdsByParentId.set(task.parentTaskId, childIds);
  });

  const descendants = new Set<number>();
  const pendingTaskIds = [...(childIdsByParentId.get(taskId) ?? [])];
  while (pendingTaskIds.length > 0) {
    const currentTaskId = pendingTaskIds.pop();
    if (
      currentTaskId === undefined ||
      currentTaskId === taskId ||
      descendants.has(currentTaskId)
    ) {
      continue;
    }
    descendants.add(currentTaskId);
    pendingTaskIds.push(...(childIdsByParentId.get(currentTaskId) ?? []));
  }
  return descendants;
};

/**
 * 親にできるsummary Taskを安全な階層表示順で返す。
 * 自分自身と子孫を候補から外し、Frontendでも明らかな循環操作を防ぐ。
 *
 * @param tasks Project内のWBS Task
 * @param editingTaskId 編集対象Task ID
 * @returns 最上位を先頭にした親Task選択肢
 */
export const buildWbsParentOptions = (
  tasks: readonly WbsTask[],
  editingTaskId: number
): WbsParentOption[] => {
  const excludedTaskIds = collectDescendantTaskIds(tasks, editingTaskId);
  excludedTaskIds.add(editingTaskId);
  const summaryOptions = buildWbsTreeRows(tasks)
    .filter(
      (task) =>
        task.taskType === "SUMMARY" && !excludedTaskIds.has(task.taskId)
    )
    .map((task) => ({
      title: `${"　".repeat(task.depth)}${task.wbsCode ? `${task.wbsCode} ` : ""}${task.title}`,
      value: task.taskId,
    }));
  return [{ title: "最上位", value: null }, ...summaryOptions];
};

/** yyyy-MM-ddとして存在する日付かをtimezoneに依存せず検査する。 */
const isValidIsoLocalDate = (value: string): boolean => {
  if (!ISO_LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
};

/** 小数第2位までの数値かを浮動小数点誤差を許容して判定する。 */
const hasAtMostTwoDecimalPlaces = (value: number): boolean =>
  Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * 100;

/**
 * WBS Task編集フォームをBackendと同じ主要制約で検証する。
 * Project状態、親Taskの最新状態、子Task有無、versionは同時更新があるためBackendを最終判定とする。
 *
 * @param form Dialogから受け取った入力値
 * @returns 利用者へ表示する検証メッセージ。問題がなければ空配列
 */
export const validateWbsTaskEditForm = (
  form: Readonly<WbsTaskEditForm>
): string[] => {
  const messages: string[] = [];
  if (form.wbsCode.trim().length > 100) {
    messages.push("WBSコードは100文字以内で入力してください。");
  }
  if (
    !isValidIsoLocalDate(form.plannedStartDate) ||
    !isValidIsoLocalDate(form.plannedEndDate)
  ) {
    messages.push("予定開始日と予定終了日を入力してください。");
  } else if (form.plannedStartDate > form.plannedEndDate) {
    messages.push("予定終了日は予定開始日以降にしてください。");
  }
  if (
    form.plannedEffortMinutes === null ||
    !Number.isSafeInteger(form.plannedEffortMinutes) ||
    form.plannedEffortMinutes < 0
  ) {
    messages.push("予定工数は0以上の整数（分）で入力してください。");
  }
  if (
    form.progressPercent === null ||
    !Number.isFinite(form.progressPercent) ||
    form.progressPercent < 0 ||
    form.progressPercent > 100 ||
    !hasAtMostTwoDecimalPlaces(form.progressPercent)
  ) {
    messages.push("進捗率は0から100まで、小数第2位以内で入力してください。");
  }
  if (
    form.taskType === "MILESTONE" &&
    (form.plannedStartDate !== form.plannedEndDate ||
      form.plannedEffortMinutes !== 0)
  ) {
    messages.push("Milestoneは開始日と終了日を同日にし、予定工数を0分にしてください。");
  }
  return messages;
};

/** 検証済みフォームから空白WBSコードをnullへ正規化した更新Requestを作る。 */
export const buildWbsTaskUpdateRequest = (
  form: Readonly<WbsTaskEditForm>
): WbsTaskUpdateRequest => ({
  parentTaskId: form.parentTaskId,
  taskType: form.taskType,
  wbsCode: form.wbsCode.trim() || null,
  plannedStartDate: form.plannedStartDate,
  plannedEndDate: form.plannedEndDate,
  plannedEffortMinutes: form.plannedEffortMinutes as number,
  progressPercent: form.progressPercent as number,
  version: form.version,
});
