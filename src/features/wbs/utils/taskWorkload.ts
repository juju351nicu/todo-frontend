import type { TaskWorkloadRow } from "@/features/wbs/types/wbs";
import type { SemanticColor } from "@/shared/types/color";

/** workload行の稼働可能時間に対する予定配賦状態。 */
export type WorkloadCapacityStatus =
  | "WITHIN_CAPACITY"
  | "OVER_ALLOCATED"
  | "HOLIDAY_ALLOCATION";

/**
 * Backendが解決した稼働可能時間と予定工数から、画面に表示する容量状態を決定する。
 *
 * 休日は稼働可能時間0分として返るため、一般の過配賦より先に判定して理由を明確にする。
 *
 * @param workload 日付・担当者単位のworkload行
 * @returns 配賦内、過配賦、休日配賦のいずれか
 */
export const resolveWorkloadCapacityStatus = (
  workload: Readonly<TaskWorkloadRow>
): WorkloadCapacityStatus => {
  if (
    workload.overAllocated &&
    workload.availableMinutes === 0 &&
    workload.plannedEffortMinutes > 0
  ) {
    return "HOLIDAY_ALLOCATION";
  }
  return workload.overAllocated ? "OVER_ALLOCATED" : "WITHIN_CAPACITY";
};

const CAPACITY_LABELS: Readonly<Record<WorkloadCapacityStatus, string>> = {
  WITHIN_CAPACITY: "配賦内",
  OVER_ALLOCATED: "過配賦",
  HOLIDAY_ALLOCATION: "休日配賦",
};

/** 実績-予定の差分を注意度の色へ変換する。予定超過はerror、予定未満はwarning、一致はsuccess。 */
export const getWorkloadVarianceColor = (varianceEffortMinutes: number): SemanticColor => {
  if (varianceEffortMinutes > 0) {
    return "error";
  }
  return varianceEffortMinutes < 0 ? "warning" : "success";
};

/** 容量状態を色へ変換する。配賦内だけsuccess、過配賦・休日配賦はerror。 */
export const getWorkloadCapacityColor = (workload: Readonly<TaskWorkloadRow>): SemanticColor =>
  resolveWorkloadCapacityStatus(workload) === "WITHIN_CAPACITY" ? "success" : "error";

/** 容量状態を担当者が判断できる日本語へ変換する。 */
export const getWorkloadCapacityLabel = (workload: Readonly<TaskWorkloadRow>): string =>
  CAPACITY_LABELS[resolveWorkloadCapacityStatus(workload)];

/**
 * 同じ表示名を持つ別々の担当者がいる表示名を集める。
 * workload表では担当者を表示名で示し、同名の人がいるときだけアカウントIDを添えて見分ける（改善提案 1-20）。
 *
 * @param workloads 担当者別workloadの行。同じ担当者が日付ごとに複数行あってもよい
 * @returns 2人以上のアカウントIDが使っている表示名。該当がなければ空集合
 */
export const findDuplicatedWorkloadDisplayNames = (
  workloads: readonly Readonly<TaskWorkloadRow>[]
): ReadonlySet<string> => {
  const accountIdsByName = new Map<string, Set<number>>();
  for (const row of workloads) {
    const accountIds = accountIdsByName.get(row.accountDisplayName) ?? new Set<number>();
    accountIds.add(row.accountId);
    accountIdsByName.set(row.accountDisplayName, accountIds);
  }
  return new Set(
    [...accountIdsByName]
      .filter(([, accountIds]) => accountIds.size > 1)
      .map(([displayName]) => displayName)
  );
};
