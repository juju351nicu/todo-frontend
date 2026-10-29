import type { TaskPriority } from "@/features/project/types/project";
import type { SemanticColor } from "@/shared/types/color";
import { BUSINESS_TIME_ZONE } from "@/shared/utils/businessDate";

const TODO_PRIORITY_LABELS: Readonly<Record<number, string>> = {
  1: "低",
  2: "中",
  3: "高",
};

/** Todoの重要度コードを表示名へ変換する。 */
export const getTodoPriorityLabel = (priority: number | string): string =>
  TODO_PRIORITY_LABELS[Number(priority)] ?? "不明";

/** Todoの重要度コードを表示色へ変換する。 */
export const getTodoPriorityColor = (priority: number | string): string => {
  switch (Number(priority)) {
    case 1:
      return "#000080";
    case 2:
      return "#ff00ff";
    default:
      return "#ff0000";
  }
};

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

/** Todo詳細を一覧用の最大3文字へ省略する。 */
export const truncateTodoDetail = (value: string): string => value.slice(0, 3);

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  timeZone: BUSINESS_TIME_ZONE,
  month: "long",
  day: "numeric",
});

/**
 * Todo検索cardに表示する東京の月日（例: `11月8日`）を作る。
 *
 * @param date 表示する日時。省略時は現在時刻
 */
export const formatTodoSearchDate = (date: Date = new Date()): string => MONTH_DAY_FORMATTER.format(date);

const TASK_PRIORITY_LABELS: Readonly<Record<TaskPriority, string>> = { 1: "低", 2: "中", 3: "高" };

// Backendの`TaskPriority`はLOW=1、MEDIUM=2、HIGH=3。高いほど注意を引く色にする。
const TASK_PRIORITY_COLORS: Readonly<Record<TaskPriority, SemanticColor>> = { 1: "info", 2: "warning", 3: "error" };

/** Project TaskとWBS Taskの優先度コード（1:低、2:中、3:高）を表示名へ変換する。 */
export const getTaskPriorityLabel = (priority: TaskPriority): string => TASK_PRIORITY_LABELS[priority];

/** Project TaskとWBS Taskの優先度コードを表示色へ変換する。高=error、中=warning、低=info。 */
export const getTaskPriorityColor = (priority: TaskPriority): SemanticColor => TASK_PRIORITY_COLORS[priority];
