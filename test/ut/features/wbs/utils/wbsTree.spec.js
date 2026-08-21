import { describe, expect, it } from "vitest";

import {
  buildWbsTreeRows,
  formatPlannedEffort,
  formatProgressPercent,
  normalizeProgressPercent,
} from "@/features/wbs/utils/wbsTree";

const buildTask = (overrides) => ({
  taskId: 1,
  parentTaskId: null,
  taskType: "TASK",
  wbsCode: null,
  title: "Task",
  detail: "詳細",
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-08-02",
  plannedEffortMinutes: 60,
  progressPercent: 0,
  assigneeAccountId: 1,
  priority: 2,
  taskStatusId: 1,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 0,
  ...overrides,
});

describe("WBS階層変換", () => {
  it("API順に依存せず親の直後へ子孫をposition順で並べる", () => {
    const tasks = [
      buildTask({ taskId: 4, parentTaskId: 2, position: 2000, title: "孫" }),
      buildTask({ taskId: 3, parentTaskId: 1, position: 2000, title: "子2" }),
      buildTask({ taskId: 2, parentTaskId: 1, position: 1000, title: "子1" }),
      buildTask({ taskId: 1, parentTaskId: null, position: 1000, title: "親" }),
      buildTask({ taskId: 5, parentTaskId: null, position: 2000, title: "別親" }),
    ];

    const rows = buildWbsTreeRows(tasks);

    expect(rows.map((row) => [row.taskId, row.depth])).toEqual([
      [1, 0],
      [2, 1],
      [4, 2],
      [3, 1],
      [5, 0],
    ]);
    expect(rows.find((row) => row.taskId === 1)?.hasChildren).toBe(true);
    expect(rows.find((row) => row.taskId === 3)?.hasChildren).toBe(false);
  });

  it("親欠損・自己参照・循環があっても全Taskを1回ずつ表示する", () => {
    const tasks = [
      buildTask({ taskId: 1, parentTaskId: 99 }),
      buildTask({ taskId: 2, parentTaskId: 2 }),
      buildTask({ taskId: 3, parentTaskId: 4 }),
      buildTask({ taskId: 4, parentTaskId: 3 }),
    ];

    const rows = buildWbsTreeRows(tasks);

    expect(rows.map((row) => row.taskId).sort()).toEqual([1, 2, 3, 4]);
    expect(new Set(rows.map((row) => row.taskId)).size).toBe(rows.length);
  });

  it("同じTask IDが重複しても最初のTaskだけを表示する", () => {
    const rows = buildWbsTreeRows([
      buildTask({ taskId: 1, title: "先" }),
      buildTask({ taskId: 1, title: "後" }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("先");
  });
});

describe("WBS表示変換", () => {
  it("分単位の予定工数を時間と分へ変換する", () => {
    expect(formatPlannedEffort(0)).toBe("0分");
    expect(formatPlannedEffort(45)).toBe("45分");
    expect(formatPlannedEffort(60)).toBe("1時間");
    expect(formatPlannedEffort(150)).toBe("2時間30分");
    expect(formatPlannedEffort(-1)).toBe("—");
    expect(formatPlannedEffort(1.5)).toBe("—");
  });

  it("進捗率を0から100へ制限し、小数第2位まで表示する", () => {
    expect(normalizeProgressPercent(-20)).toBe(0);
    expect(normalizeProgressPercent(120)).toBe(100);
    expect(normalizeProgressPercent(Number.NaN)).toBe(0);
    expect(formatProgressPercent(33.5)).toBe("33.5");
    expect(formatProgressPercent(33.33)).toBe("33.33");
  });
});
