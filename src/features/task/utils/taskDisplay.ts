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

/** 残日数を一覧表示用の文字列へ変換する。 */
export const formatRemainingDays = (value: number): string =>
  `残り${value}日間`;

/** Todo詳細を一覧用の最大3文字へ省略する。 */
export const truncateTodoDetail = (value: string): string => value.slice(0, 3);
