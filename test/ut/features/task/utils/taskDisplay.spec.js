import { describe, expect, it } from "vitest";

import {
  formatRemainingDays,
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
    expect(truncateTodoDetail("詳細情報")).toBe("詳細情");
  });
});
