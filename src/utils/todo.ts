const TODO_PRIORITY_LABELS: Readonly<Record<number, string>> = {
  1: "低",
  2: "中",
  3: "高",
};

/** Todoの重要度コードを表示名へ変換する。 */
export const getTodoPriorityLabel = (priority: number | string): string =>
  TODO_PRIORITY_LABELS[Number(priority)] ?? "不明";
