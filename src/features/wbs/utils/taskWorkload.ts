import type { TaskWorkloadRow } from "@/features/wbs/types/wbs";

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
