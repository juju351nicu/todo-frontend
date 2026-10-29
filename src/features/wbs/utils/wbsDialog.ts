import type { WbsTask } from "@/features/wbs/types/wbs";
import { formatEffortMinutes } from "@/features/wbs/utils/effort";
import type { SemanticColor } from "@/shared/types/color";

/**
 * Task単位のDialog見出しを作る。
 *
 * @param prefix 見出しの機能名（例: `Task日別予定工数`）
 * @param task 対象Task。未選択の場合は機能名だけを返す
 * @param includeWbsCode trueの場合、WBS codeがあればTask名の前に付ける
 */
export const formatWbsTaskDialogTitle = (
  prefix: string,
  task: WbsTask | null,
  includeWbsCode = true
): string => {
  if (task === null) {
    return prefix;
  }
  const code = includeWbsCode && task.wbsCode ? `${task.wbsCode} ` : "";
  return `${prefix}: ${code}${task.title}`;
};

/**
 * 日別予定・実績の入力で、担当者／作業者の既定アカウントIDを決める。
 *
 * @param task 対象Task。Task担当者が選択肢に含まれる場合はその担当者を既定にする
 * @param options 利用者が選べるアカウントの選択肢
 * @returns 選択肢がない場合はnull
 */
export const resolveDefaultAccountId = (
  task: WbsTask | null,
  options: readonly { value: number }[]
): number | null => {
  const taskAssigneeId = task?.assigneeAccountId ?? null;
  if (options.some((option) => option.value === taskAssigneeId)) {
    return taskAssigneeId;
  }
  return options[0]?.value ?? null;
};

/** 日別予定の配賦状況の表示。 */
export interface EffortAllocationStatus {
  color: SemanticColor;
  label: string;
}

/**
 * Taskの予定工数に対する日別予定の配賦状況を表示へ変換する。
 *
 * @param unallocatedMinutes 未配賦の分数。負値は予定工数を超えて配賦した過配賦
 * @returns 過配賦はerror、ちょうど配賦済みはsuccess、未配賦が残る場合はwarning
 */
export const getEffortAllocationStatus = (unallocatedMinutes: number): EffortAllocationStatus => {
  if (unallocatedMinutes < 0) {
    return { color: "error", label: `過配賦 ${formatEffortMinutes(Math.abs(unallocatedMinutes))}` };
  }
  return {
    color: unallocatedMinutes === 0 ? "success" : "warning",
    label: `未配賦 ${formatEffortMinutes(unallocatedMinutes)}`,
  };
};

/**
 * 日別予定・実績の1件を、現在の利用者が画面上で更新・削除できるか判定する。最終認可はBackendが行う。
 *
 * @param canEdit 対象Taskを編集できる場合はtrue
 * @param canManageAny 他人の登録分も管理できる場合はtrue
 * @param ownerAccountId その予定・実績の担当者／作業者
 * @param currentAccountId 現在の利用者。未認証はnull
 */
export const canMutateOwnedEntry = (
  canEdit: boolean,
  canManageAny: boolean,
  ownerAccountId: number,
  currentAccountId: number | null
): boolean => canEdit && (canManageAny || ownerAccountId === currentAccountId);
