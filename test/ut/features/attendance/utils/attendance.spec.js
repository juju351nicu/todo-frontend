import { describe, expect, it } from "vitest";

import {
  buildAttendanceMonthDateRange,
  buildAttendanceMonthRows,
  formatAttendanceMinutes,
  getTodayInTokyo,
  summarizeAttendanceDay,
} from "@/features/attendance/utils/attendance";

const buildDay = (overrides = {}) => ({
  attendanceDayId: 1,
  workDate: "2026-09-06",
  note: null,
  punchState: "OFF_DUTY",
  workPeriods: [],
  ...overrides,
});

describe("本人勤怠表示utility", () => {
  it("UTC日付境界の時刻をAsia/Tokyoの業務日へ変換する", () => {
    expect(getTodayInTokyo(new Date("2026-09-05T15:30:00Z"))).toBe(
      "2026-09-06"
    );
  });

  it("通常月と閏年2月の月初・月末をAPI検索範囲へ変換する", () => {
    expect(buildAttendanceMonthDateRange("2026-09")).toEqual({
      dateFrom: "2026-09-01",
      dateTo: "2026-09-30",
    });
    expect(buildAttendanceMonthDateRange("2028-02").dateTo).toBe(
      "2028-02-29"
    );
    expect(() => buildAttendanceMonthDateRange("2026-13")).toThrow(
      "実在する表示月"
    );
  });

  it("複数勤務・休憩区間から総勤務、休憩、差引時間を算出する", () => {
    const day = buildDay({
      workPeriods: [
        {
          attendanceWorkPeriodId: 1,
          startedAt: "2026-09-06T00:00:00Z",
          endedAt: "2026-09-06T04:00:00Z",
          entrySource: "SELF_PUNCH",
          breakPeriods: [
            {
              attendanceBreakPeriodId: 1,
              startedAt: "2026-09-06T02:00:00Z",
              endedAt: "2026-09-06T02:30:00Z",
              entrySource: "SELF_PUNCH",
            },
          ],
        },
        {
          attendanceWorkPeriodId: 2,
          startedAt: "2026-09-06T05:00:00Z",
          endedAt: "2026-09-06T08:00:00Z",
          entrySource: "SELF_PUNCH",
          breakPeriods: [],
        },
      ],
    });

    expect(summarizeAttendanceDay(day)).toEqual({
      grossWorkMinutes: 420,
      breakMinutes: 30,
      netWorkMinutes: 390,
      incomplete: false,
    });
  });

  it("未終了区間を確定時間へ含めず集計中として示す", () => {
    const day = buildDay({
      punchState: "WORKING",
      workPeriods: [
        {
          attendanceWorkPeriodId: 1,
          startedAt: "2026-09-06T00:00:00Z",
          endedAt: null,
          entrySource: "SELF_PUNCH",
          breakPeriods: [],
        },
      ],
    });

    expect(summarizeAttendanceDay(day)).toEqual({
      grossWorkMinutes: 0,
      breakMinutes: 0,
      netWorkMinutes: 0,
      incomplete: true,
    });
  });

  it("月内全日を作り未打刻日と登録済み勤怠を結合する", () => {
    const rows = buildAttendanceMonthRows("2026-09", [
      buildDay({
        workDate: "2026-09-06",
        punchState: "WORKING",
      }),
    ]);

    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({
      workDate: "2026-09-01",
      hasRecord: false,
      punchState: "OFF_DUTY",
    });
    expect(rows[5]).toMatchObject({
      workDate: "2026-09-06",
      hasRecord: true,
      punchState: "WORKING",
    });
  });

  it("分単位時間を0分・分・時間・時間分へ整形する", () => {
    expect(formatAttendanceMinutes(0)).toBe("0分");
    expect(formatAttendanceMinutes(45)).toBe("45分");
    expect(formatAttendanceMinutes(120)).toBe("2時間");
    expect(formatAttendanceMinutes(135)).toBe("2時間15分");
  });
});
