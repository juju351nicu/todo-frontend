import { describe, expect, it } from "vitest";

import {
  resolveWorkloadCapacityStatus,
  getWorkloadCapacityColor,
  getWorkloadCapacityLabel,
  getWorkloadVarianceColor,
} from "@/features/wbs/utils/taskWorkload";

/** 容量判定に不要な表示項目を共通化したworkload fixtureを作る。 */
const buildWorkload = (overrides = {}) => ({
  workDate: "2026-08-31",
  accountId: 2,
  accountDisplayName: "担当者",
  plannedEffortMinutes: 300,
  actualEffortMinutes: 0,
  varianceEffortMinutes: -300,
  availableMinutes: 480,
  remainingMinutes: 180,
  overAllocated: false,
  ...overrides,
});

describe("taskWorkload", () => {
  it("予定工数が稼働可能時間以下なら配賦内にする", () => {
    expect(resolveWorkloadCapacityStatus(buildWorkload())).toBe(
      "WITHIN_CAPACITY"
    );
  });

  it("予定工数が稼働可能時間を超えたら過配賦にする", () => {
    expect(
      resolveWorkloadCapacityStatus(
        buildWorkload({
          plannedEffortMinutes: 540,
          remainingMinutes: -60,
          overAllocated: true,
        })
      )
    ).toBe("OVER_ALLOCATED");
  });

  it("休日0分へ予定を配賦した場合は一般の過配賦と区別する", () => {
    expect(
      resolveWorkloadCapacityStatus(
        buildWorkload({
          plannedEffortMinutes: 60,
          availableMinutes: 0,
          remainingMinutes: -60,
          overAllocated: true,
        })
      )
    ).toBe("HOLIDAY_ALLOCATION");
  });
});

describe("workload表示", () => {
  it.each([
    [30, "error"],
    [-30, "warning"],
    [0, "success"],
  ])("実績-予定の差分%i分を%sで表示する", (variance, color) => {
    expect(getWorkloadVarianceColor(variance)).toBe(color);
  });

  it("休日配賦を過配賦より先に判定して表示する", () => {
    const holiday = { overAllocated: true, availableMinutes: 0, plannedEffortMinutes: 60 };
    const within = { overAllocated: false, availableMinutes: 480, plannedEffortMinutes: 60 };

    expect(getWorkloadCapacityLabel(holiday)).toBe("休日配賦");
    expect(getWorkloadCapacityColor(holiday)).toBe("error");
    expect(getWorkloadCapacityLabel(within)).toBe("配賦内");
    expect(getWorkloadCapacityColor(within)).toBe("success");
  });
});
