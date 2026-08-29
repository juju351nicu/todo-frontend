import { describe, expect, it } from "vitest";

import {
  buildWbsBaselineComparisonRows,
  buildWbsBaselineCreateRequest,
  validateWbsBaselineCreateForm,
} from "@/features/wbs/utils/wbsBaseline";

const buildCurrentTask = (overrides = {}) => ({
  taskId: 11,
  parentTaskId: null,
  taskType: "TASK",
  wbsCode: "1.1",
  title: "設計",
  detail: "",
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-08-02",
  plannedEffortMinutes: 480,
  progressPercent: 0,
  actualStartDate: null,
  actualEndDate: null,
  assigneeAccountId: 1,
  priority: 2,
  taskStatusId: 1,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 0,
  ...overrides,
});

const buildBaselineTask = (overrides = {}) => ({
  sourceTaskId: 11,
  parentSourceTaskId: null,
  taskType: "TASK",
  wbsCode: "1.1",
  position: 1000,
  title: "設計",
  detail: "",
  priority: 2,
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-08-02",
  plannedEffortMinutes: 480,
  assigneeAccountId: 1,
  sourceTaskVersion: 0,
  ...overrides,
});

describe("WBS baseline utility", () => {
  it("作成Formをtrimし空説明をnullへ変換する", () => {
    expect(
      buildWbsBaselineCreateRequest({
        name: "  8月計画  ",
        description: "   ",
      })
    ).toEqual({ name: "8月計画", description: null });
  });

  it("必須名とBackend同等の文字数上限をまとめて検査する", () => {
    expect(
      validateWbsBaselineCreateForm({
        name: " ",
        description: "a".repeat(1001),
      })
    ).toEqual([
      "baseline名を入力してください。",
      "説明は1000文字以内で入力してください。",
    ]);
  });

  it("現在順を維持して変更・追加・除外と工数差分をTask IDで比較する", () => {
    const rows = buildWbsBaselineComparisonRows(
      [
        buildCurrentTask(),
        buildCurrentTask({
          taskId: 12,
          title: "実装",
          plannedEffortMinutes: 600,
        }),
        buildCurrentTask({ taskId: 13, title: "追加検証" }),
      ],
      [
        buildBaselineTask(),
        buildBaselineTask({
          sourceTaskId: 12,
          title: "実装",
          plannedEffortMinutes: 480,
        }),
        buildBaselineTask({ sourceTaskId: 14, title: "旧検証" }),
      ]
    );

    expect(rows.map((row) => [row.sourceTaskId, row.status])).toEqual([
      [11, "UNCHANGED"],
      [12, "CHANGED"],
      [13, "CURRENT_ONLY"],
      [14, "BASELINE_ONLY"],
    ]);
    expect(rows[1].plannedEffortDifferenceMinutes).toBe(120);
    expect(rows[2]).toMatchObject({
      baselinePlannedEffortMinutes: null,
      plannedEffortDifferenceMinutes: 480,
    });
    expect(rows[3]).toMatchObject({
      currentPlannedEffortMinutes: null,
      plannedEffortDifferenceMinutes: -480,
    });
  });
});
