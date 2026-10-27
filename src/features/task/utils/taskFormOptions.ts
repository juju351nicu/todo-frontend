import type { TaskPriority, TaskStatus } from "@/features/project/types/project";

/** Task入力のselect選択肢。`title`は表示名、`value`はBackendへ送る値。 */
export interface TaskSelectOption<TValue> {
  title: string;
  value: TValue;
}

/** Task優先度の選択肢。BackendのTaskPriorityと同じく1=低、2=中、3=高。 */
export const TASK_PRIORITY_OPTIONS: readonly TaskSelectOption<TaskPriority>[] = [
  { title: "低", value: 1 },
  { title: "中", value: 2 },
  { title: "高", value: 3 },
];

/**
 * Board列をtask status ID選択肢へ変換する。
 *
 * @param statuses Projectの全Board列
 * @param excludeCompleted trueの場合、完了列を除く（繰り返しTaskの生成先など未完了列だけを許可する入力）
 */
export const buildTaskStatusIdOptions = (
  statuses: readonly TaskStatus[],
  excludeCompleted = false,
): TaskSelectOption<number>[] =>
  statuses
    .filter((status) => !excludeCompleted || !status.completed)
    .map((status) => ({ title: status.name, value: status.taskStatusId }));

/** Board列をstatus code選択肢へ変換する。Templateのように列IDではなくcodeで保存する入力に使う。 */
export const buildTaskStatusCodeOptions = (statuses: readonly TaskStatus[]): TaskSelectOption<string>[] =>
  statuses.map((status) => ({ title: `${status.name}（${status.statusCode}）`, value: status.statusCode }));
