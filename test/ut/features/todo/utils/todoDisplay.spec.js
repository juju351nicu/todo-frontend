import { describe, expect, it } from "vitest";

import {
  formatTodoSearchDate,
  getTodoPriorityColor,
  getTodoPriorityLabel,
  truncateTodoDetail,
} from "@/features/todo/utils/todoDisplay";

describe("旧Todoの表示変換", () => {
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

  it("詳細を一覧表示用の3文字へ省略する", () => {
    expect(truncateTodoDetail("詳細情報")).toBe("詳細情");
  });
});

describe("formatTodoSearchDate", () => {
  it("東京の日付で月日を表示する", () => {
    // UTC 15:30は東京では翌日0:30になる。
    expect(formatTodoSearchDate(new Date("2026-11-07T15:30:00Z"))).toBe("11月8日");
  });
});
