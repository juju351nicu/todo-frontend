import { describe, expect, it } from "vitest";

import {
  formatRemainingDays,
  getTaskPriorityColor,
  getTaskPriorityLabel,
} from "@/features/task/utils/taskDisplay";

describe("formatRemainingDays", () => {
  it("期限までの日数を期限超過・今日・残り日数で表す", () => {
    expect(formatRemainingDays(-2)).toBe("2日超過");
    expect(formatRemainingDays(0)).toBe("今日");
    expect(formatRemainingDays(5)).toBe("残り5日");
  });
});

describe("Project Task優先度表示", () => {
  // 高いほど注意を引く色にする（低=info、中=warning、高=error）。逆にすると高優先度が目立たなくなる。
  it.each([
    [1, "低", "info"],
    [2, "中", "warning"],
    [3, "高", "error"],
  ])("優先度%iは%sで%s色", (priority, label, color) => {
    expect(getTaskPriorityLabel(priority)).toBe(label);
    expect(getTaskPriorityColor(priority)).toBe(color);
  });
});
