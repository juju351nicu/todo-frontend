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
export const formatTodoSearchDate = (date: Date = new Date()): string =>
  MONTH_DAY_FORMATTER.format(date);
