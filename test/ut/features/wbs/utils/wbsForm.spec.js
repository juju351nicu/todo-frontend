import { describe, expect, it } from "vitest";

import {
  buildWbsParentOptions,
  buildWbsTaskEditForm,
  buildWbsTaskUpdateRequest,
  validateWbsTaskEditForm,
} from "@/features/wbs/utils/wbsForm";

const buildTask = (overrides = {}) => ({
  taskId: 1,
  parentTaskId: null,
  taskType: "SUMMARY",
  wbsCode: "1",
  title: "Phase 1",
  detail: "開発Phase",
  plannedStartDate: "2026-08-22",
  plannedEndDate: "2026-08-24",
  plannedEffortMinutes: 480,
  progressPercent: 25,
  assigneeAccountId: 2,
  priority: 2,
  taskStatusId: 11,
  taskStatusCode: "TODO",
  taskStatusName: "Todo",
  position: 1000,
  version: 4,
  ...overrides,
});

describe("WBS Task編集フォーム", () => {
  it("API Responseを空WBSコードも編集できる独立フォームへ変換する", () => {
    const task = buildTask({ wbsCode: null });

    const form = buildWbsTaskEditForm(task);
    form.plannedEffortMinutes = 60;

    expect(form).toEqual({
      parentTaskId: null,
      taskType: "SUMMARY",
      wbsCode: "",
      plannedStartDate: "2026-08-22",
      plannedEndDate: "2026-08-24",
      plannedEffortMinutes: 60,
      progressPercent: 25,
      version: 4,
    });
    expect(task.plannedEffortMinutes).toBe(480);
  });

  it("親候補をSummaryに限定し自分自身と全子孫を除外する", () => {
    const tasks = [
      buildTask(),
      buildTask({
        taskId: 2,
        parentTaskId: 1,
        taskType: "SUMMARY",
        wbsCode: "1.1",
        title: "設計",
      }),
      buildTask({
        taskId: 3,
        parentTaskId: 2,
        taskType: "SUMMARY",
        wbsCode: "1.1.1",
        title: "詳細設計",
      }),
      buildTask({
        taskId: 4,
        taskType: "SUMMARY",
        wbsCode: "2",
        title: "別Phase",
        position: 2000,
      }),
      buildTask({ taskId: 5, taskType: "TASK", title: "通常Task" }),
    ];

    expect(buildWbsParentOptions(tasks, 2)).toEqual([
      { title: "最上位", value: null },
      { title: "1 Phase 1", value: 1 },
      { title: "2 別Phase", value: 4 },
    ]);
  });

  it("日付順序・工数・進捗率をAPI送信前にまとめて検証する", () => {
    const form = buildWbsTaskEditForm(buildTask());
    form.wbsCode = "x".repeat(101);
    form.plannedStartDate = "2026-08-31";
    form.plannedEndDate = "2026-08-30";
    form.plannedEffortMinutes = 1.5;
    form.progressPercent = 100.123;

    expect(validateWbsTaskEditForm(form)).toEqual([
      "WBSコードは100文字以内で入力してください。",
      "予定終了日は予定開始日以降にしてください。",
      "予定工数は0以上の整数（分）で入力してください。",
      "進捗率は0から100まで、小数第2位以内で入力してください。",
    ]);
  });

  it("存在しない日付を有効なISO local dateとして扱わない", () => {
    const form = buildWbsTaskEditForm(buildTask());
    form.plannedStartDate = "2026-02-30";

    expect(validateWbsTaskEditForm(form)).toContain(
      "予定開始日と予定終了日を入力してください。"
    );
  });

  it("Milestoneは同日かつ予定工数0分だけを許可する", () => {
    const form = buildWbsTaskEditForm(
      buildTask({ taskType: "MILESTONE", plannedEffortMinutes: 60 })
    );

    expect(validateWbsTaskEditForm(form)).toContain(
      "Milestoneは開始日と終了日を同日にし、予定工数を0分にしてください。"
    );

    form.plannedEndDate = form.plannedStartDate;
    form.plannedEffortMinutes = 0;
    expect(validateWbsTaskEditForm(form)).toEqual([]);
  });

  it("検証済みフォームの空白WBSコードをnullへ正規化してversionを保持する", () => {
    const form = buildWbsTaskEditForm(buildTask());
    form.parentTaskId = 9;
    form.wbsCode = "   ";
    form.progressPercent = 37.5;

    expect(buildWbsTaskUpdateRequest(form)).toEqual({
      parentTaskId: 9,
      taskType: "SUMMARY",
      wbsCode: null,
      plannedStartDate: "2026-08-22",
      plannedEndDate: "2026-08-24",
      plannedEffortMinutes: 480,
      progressPercent: 37.5,
      version: 4,
    });
  });
});
