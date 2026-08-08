import { describe, expect, it } from "vitest";

import { getTodoPriorityLabel } from "@/utils/todo.js";

describe("Todo表示変換", () => {
  it.each([
    [1, "低"],
    [2, "中"],
    [3, "高"],
    [99, "不明"],
  ])("重要度%sを%sへ変換する", (priority, expected) => {
    expect(getTodoPriorityLabel(priority)).toBe(expected);
  });
});
