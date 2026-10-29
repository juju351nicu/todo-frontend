import type { TaskPriority } from "@/features/project/types/project";
import type { SemanticColor } from "@/shared/types/color";

/**
 * 今日（業務日）から期限までの符号付き日数を、期限超過・今日・残り日数の表現へ変換する。
 * My Tasks・Task検索・Dashboard・旧Todo一覧で同じ表現にする。
 *
 * @param value Backendが返す期限までの日数。期限当日は0、期限切れは負数
 * @returns 例: `2日超過`、`今日`、`残り5日`
 */
export const formatRemainingDays = (value: number): string => {
  if (value < 0) {
    return `${Math.abs(value)}日超過`;
  }
  if (value === 0) {
    return "今日";
  }
  return `残り${value}日`;
};

const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = { 1: "低", 2: "中", 3: "高" };

// Backendの`TaskPriority`はLOW=1、MEDIUM=2、HIGH=3。高いほど注意を引く色にする。
const TASK_PRIORITY_COLORS: Readonly<Record<TaskPriority, SemanticColor>> = { 1: "info", 2: "warning", 3: "error" };

/** Project TaskとWBS Taskの優先度コード（1:低、2:中、3:高）を表示名へ変換する。 */
export const getTaskPriorityLabel = (priority: TaskPriority): string => TASK_PRIORITY_LABELS[priority];

/** Project TaskとWBS Taskの優先度コードを表示色へ変換する。高=error、中=warning、低=info。 */
export const getTaskPriorityColor = (priority: TaskPriority): SemanticColor => TASK_PRIORITY_COLORS[priority];
