import { describe, expect, it } from "vitest";

import {
  canMutateOwnedEntry,
  formatWbsTaskDialogTitle,
  getEffortAllocationStatus,
  resolveDefaultAccountId,
} from "@/features/wbs/utils/wbsDialog";

const task = { taskId: 1, wbsCode: "1.2", title: "設計", assigneeAccountId: 8 };

describe("wbsDialog", () => {
  it("Dialog見出しにWBS codeとTask名を付け、未選択なら機能名だけにする", () => {
    expect(formatWbsTaskDialogTitle("Task日別予定工数", task)).toBe("Task日別予定工数: 1.2 設計");
    expect(formatWbsTaskDialogTitle("WBS Taskを編集", task, false)).toBe("WBS Taskを編集: 設計");
    expect(formatWbsTaskDialogTitle("Task日別予定工数", { ...task, wbsCode: null })).toBe(
      "Task日別予定工数: 設計"
    );
    expect(formatWbsTaskDialogTitle("Task日別予定工数", null)).toBe("Task日別予定工数");
  });

  it("Task担当者が選択肢にあれば既定にし、なければ先頭、選択肢がなければnullにする", () => {
    expect(resolveDefaultAccountId(task, [{ value: 7 }, { value: 8 }])).toBe(8);
    expect(resolveDefaultAccountId(task, [{ value: 7 }])).toBe(7);
    expect(resolveDefaultAccountId(task, [])).toBeNull();
  });

  it.each([
    [-30, "error", "過配賦 30分"],
    [0, "success", "未配賦 0分"],
    [60, "warning", "未配賦 1時間"],
  ])("未配賦%i分を%sで表示する", (minutes, color, label) => {
    expect(getEffortAllocationStatus(minutes)).toEqual({ color, label });
  });

  it("編集権限があり、全件管理または本人の登録分だけ更新できる", () => {
    expect(canMutateOwnedEntry(true, false, 7, 7)).toBe(true);
    expect(canMutateOwnedEntry(true, false, 8, 7)).toBe(false);
    expect(canMutateOwnedEntry(true, true, 8, 7)).toBe(true);
    expect(canMutateOwnedEntry(false, true, 7, 7)).toBe(false);
  });
});
