import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDefaultWorkloadDateRange,
  buildTaskEffortPlanCreateRequest,
  buildTaskEffortPlanForm,
  buildTaskEffortPlanUpdateRequest,
  validateTaskEffortPlanForm,
  validateTaskWorkloadDateRange,
} from "@/features/wbs/utils/taskEffortPlan";

const effortPlan = {
  effortPlanId: 51,
  taskId: 11,
  planDate: "2026-08-22",
  plannedEffortMinutes: 300,
  assigneeAccountId: 2,
  assigneeDisplayName: "担当者",
  createdBy: 2,
  createdAt: "2026-08-22T01:00:00Z",
  updatedBy: 2,
  updatedAt: "2026-08-22T01:00:00Z",
  version: 3,
};

describe("Task日別予定工数utility", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ブラウザー現在月の初日と末日をworkload初期期間にする", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    expect(buildDefaultWorkloadDateRange()).toEqual({
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
    });
  });

  it("新規Formは現在日と初期担当者、編集FormはResponseの複製から作る", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0, 0));

    expect(buildTaskEffortPlanForm(2)).toEqual({
      planDate: "2026-08-22",
      plannedEffortMinutes: null,
      assigneeAccountId: 2,
    });
    expect(buildTaskEffortPlanForm(1, effortPlan)).toEqual({
      planDate: "2026-08-22",
      plannedEffortMinutes: 300,
      assigneeAccountId: 2,
    });
  });

  it("日付・分単位工数・Project memberを検証して全理由を返す", () => {
    expect(
      validateTaskEffortPlanForm(
        {
          planDate: "2026-02-30",
          plannedEffortMinutes: 1441,
          assigneeAccountId: 9,
        },
        new Set([1, 2])
      )
    ).toEqual([
      "予定日を入力してください。",
      "予定工数は1分以上1440分以下の整数で入力してください。",
      "Projectへ参加している予定担当者を選択してください。",
    ]);
  });

  it("検証済みFormを登録Requestと取得時点version付き更新Requestへ変換する", () => {
    const form = {
      planDate: "2026-08-22",
      plannedEffortMinutes: 300,
      assigneeAccountId: 2,
    };

    expect(buildTaskEffortPlanCreateRequest(form)).toEqual(form);
    expect(buildTaskEffortPlanUpdateRequest(form, 3)).toEqual({
      ...form,
      version: 3,
    });
  });

  it("workload期間は開始日以降かつ境界を含め366日以内だけ許可する", () => {
    expect(
      validateTaskWorkloadDateRange({
        dateFrom: "2026-01-01",
        dateTo: "2027-01-01",
      })
    ).toEqual([]);
    expect(
      validateTaskWorkloadDateRange({
        dateFrom: "2026-01-01",
        dateTo: "2027-01-02",
      })
    ).toEqual(["workloadの集計期間は366日以内にしてください。"]);
    expect(
      validateTaskWorkloadDateRange({
        dateFrom: "2026-08-31",
        dateTo: "2026-08-01",
      })
    ).toEqual(["集計終了日は集計開始日以降にしてください。"]);
  });
});
