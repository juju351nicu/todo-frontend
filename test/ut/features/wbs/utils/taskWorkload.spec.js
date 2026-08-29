import { describe, expect, it } from "vitest";

import { resolveWorkloadCapacityStatus } from "@/features/wbs/utils/taskWorkload";

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
