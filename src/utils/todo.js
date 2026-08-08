const TODO_PRIORITY_LABELS = Object.freeze({
  1: "低",
  2: "中",
  3: "高",
});

/**
 * Todoの重要度コードを表示名へ変換する。
 *
 * @param {number} priority 重要度コード
 * @returns {string} 重要度表示名
 */
export const getTodoPriorityLabel = (priority) =>
  TODO_PRIORITY_LABELS[Number(priority)] ?? "不明";
