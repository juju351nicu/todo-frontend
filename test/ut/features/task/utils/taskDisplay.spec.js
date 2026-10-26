import { describe, expect, it } from "vitest";

import {
  formatMyTaskRemainingDays,
  formatRemainingDays,
  formatTodoSearchDate,
  getTaskPriorityColor,
  getTaskPriorityLabel,
  getTodoPriorityColor,
  getTodoPriorityLabel,
  truncateTodoDetail,
} from "@/features/task/utils/taskDisplay";

describe("Todo表示変換", () => {
  it.each([
    [1, "低"],
    [2, "中"],
    [3, "高"],
    [99, "不明"],
  ])("重要度%sを%sへ変換する", (priority, expected) => {
    expect(getTodoPriorityLabel(priority)).toBe(expected);
  });

  it("重要度を表示色へ変換する", () => {
    expect(getTodoPriorityColor(1)).toBe("#000080");
    expect(getTodoPriorityColor("2")).toBe("#ff00ff");
    expect(getTodoPriorityColor(3)).toBe("#ff0000");
  });

  it("残日数と詳細を一覧表示用へ変換する", () => {
    expect(formatRemainingDays(5)).toBe("残り5日間");
    expect(formatMyTaskRemainingDays(-2)).toBe("2日超過");
    expect(formatMyTaskRemainingDays(0)).toBe("今日");
    expect(formatMyTaskRemainingDays(5)).toBe("残り5日");
    expect(truncateTodoDetail("詳細情報")).toBe("詳細情");
  });
});

describe("formatTodoSearchDate", () => {
  it("東京の日付で月日を表示する", () => {
    // UTC 15:30は東京では翌日0:30になる。
    expect(formatTodoSearchDate(new Date("2026-11-07T15:30:00Z"))).toBe("11月8日");
  });
});

describe("Project Task優先度表示", () => {
  // 回帰: 移行前のBoard・WBSは低優先度(1)をerror色、高優先度(3)をinfo色で表示していた。
  it.each([
    [1, "低", "info"],
    [2, "中", "warning"],
    [3, "高", "error"],
  ])("優先度%iは%sで%s色", (priority, label, color) => {
    expect(getTaskPriorityLabel(priority)).toBe(label);
    expect(getTaskPriorityColor(priority)).toBe(color);
  });
});
