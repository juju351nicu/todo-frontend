import { describe, expect, it } from "vitest";

import {
  buildAttendanceCorrectionForm,
  buildAttendanceCorrectionRequest,
  toTokyoDateTimeInput,
  toTokyoOffsetDateTime,
  validateAttendanceCorrectionForm,
} from "@/features/attendance/utils/attendanceCorrection";

describe("勤怠修正申請の画面変換と事前検証", () => {
  it("UTCの現在勤怠を東京時刻入力へ変換しoffset付き全置換Requestを組み立てる", () => {
    const day = {
      attendanceDayId: 11,
      version: 3,
      workDate: "2026-09-05",
      note: " 現在メモ ",
      punchState: "OFF_DUTY",
      workPeriods: [
        {
          attendanceWorkPeriodId: 21,
          startedAt: "2026-09-05T00:00:00Z",
          endedAt: "2026-09-05T09:00:00Z",
          entrySource: "SELF_PUNCH",
          breakPeriods: [],
        },
      ],
    };

    const form = buildAttendanceCorrectionForm(day);
    form.reason = " 退勤時刻訂正 ";

    expect(toTokyoDateTimeInput("2026-09-05T00:00:00Z")).toBe(
      "2026-09-05T09:00:00"
    );
    expect(buildAttendanceCorrectionRequest(day, form)).toEqual({
      baseDayVersion: 3,
      note: "現在メモ",
      reason: "退勤時刻訂正",
      workPeriods: [
        {
          startedAt: "2026-09-05T09:00:00+09:00",
          endedAt: "2026-09-05T18:00:00+09:00",
          breakPeriods: [],
        },
      ],
    });
  });

  it("datetime-localが秒を省略してもBackendで解釈できるInstant形式へ補完する", () => {
    expect(toTokyoOffsetDateTime("2026-09-05T18:30")).toBe(
      "2026-09-05T18:30:00+09:00"
    );
    expect(toTokyoOffsetDateTime("2026-09-05T18:30:45")).toBe(
      "2026-09-05T18:30:45+09:00"
    );
  });

  it("必須理由・逆転・勤務重複・勤務外休憩・日付違いを利用者向けに検出する", () => {
    const errors = validateAttendanceCorrectionForm("2026-09-05", {
      note: "",
      reason: " ",
      workPeriods: [
        {
          startedAt: "2026-09-05T09:00:00",
          endedAt: "2026-09-05T18:00:00",
          breakPeriods: [
            {
              startedAt: "2026-09-05T08:00:00",
              endedAt: "2026-09-05T09:30:00",
            },
          ],
        },
        {
          startedAt: "2026-09-05T17:00:00",
          endedAt: "2026-09-05T16:00:00",
          breakPeriods: [],
        },
        {
          startedAt: "2026-09-04T10:00:00",
          endedAt: "2026-09-04T11:00:00",
          breakPeriods: [],
        },
        {
          startedAt: "2026-09-05T17:00:00",
          endedAt: "2026-09-05T19:00:00",
          breakPeriods: [],
        },
      ],
    });

    expect(errors).toContain("修正理由を入力してください。");
    expect(errors).toContain("勤務区間1の休憩1は勤務時間内にしてください。");
    expect(errors).toContain("勤務区間2の終了時刻は開始時刻より後にしてください。");
    expect(errors).toContain(
      "勤務区間3の開始日時は選択した勤務日に合わせてください。"
    );
    expect(errors).toContain("勤務区間が重複しています。");
  });

  it("境界が接する勤務区間と休憩は重複扱いにしない", () => {
    const errors = validateAttendanceCorrectionForm("2026-09-05", {
      note: "",
      reason: "分割勤務",
      workPeriods: [
        {
          startedAt: "2026-09-05T09:00:00",
          endedAt: "2026-09-05T12:00:00",
          breakPeriods: [],
        },
        {
          startedAt: "2026-09-05T12:00:00",
          endedAt: "2026-09-05T18:00:00",
          breakPeriods: [
            {
              startedAt: "2026-09-05T14:00:00",
              endedAt: "2026-09-05T15:00:00",
            },
            {
              startedAt: "2026-09-05T15:00:00",
              endedAt: "2026-09-05T16:00:00",
            },
          ],
        },
      ],
    });

    expect(errors).toEqual([]);
  });

  it("対象日に開始して翌日に終了する夜勤と翌日中の休憩を許可する", () => {
    const errors = validateAttendanceCorrectionForm("2026-09-05", {
      note: "",
      reason: "夜勤の退勤時刻訂正",
      workPeriods: [
        {
          startedAt: "2026-09-05T22:00:00",
          endedAt: "2026-09-06T07:00:00",
          breakPeriods: [
            {
              startedAt: "2026-09-06T02:00:00",
              endedAt: "2026-09-06T03:00:00",
            },
          ],
        },
      ],
    });

    expect(errors).toEqual([]);
  });
});
