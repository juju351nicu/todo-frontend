import { describe, expect, it } from "vitest";

import {
  buildWorkingCalendarTargetKey,
  buildWorkingDayCreateRequest,
  buildWorkingDayForm,
  buildWorkingDayUpdateRequest,
  getWorkingDayOverride,
  parseWorkingCalendarTargetKey,
  validateWorkingCalendarDateRange,
  validateWorkingDayForm,
} from "@/features/wbs/utils/workingCalendar";

const projectOverride = {
  workingDayId: 11,
  accountId: null,
  workDate: "2026-08-22",
  dayType: "WORKING_DAY",
  availableMinutes: 360,
  createdBy: 1,
  createdAt: "2026-08-20T00:00:00Z",
  updatedBy: 1,
  updatedAt: "2026-08-20T00:00:00Z",
  version: 2,
};

const memberOverride = {
  ...projectOverride,
  workingDayId: 21,
  accountId: 2,
  dayType: "HOLIDAY",
  availableMinutes: 0,
  version: 3,
};

const calendarDay = {
  workDate: "2026-08-22",
  dayType: "HOLIDAY",
  availableMinutes: 0,
  source: "MEMBER",
  projectOverride,
  memberOverride,
};

describe("稼働日calendar変換", () => {
  it("Project共通とmember固有のselect値を相互変換する", () => {
    expect(
      buildWorkingCalendarTargetKey({ kind: "PROJECT", accountId: null })
    ).toBe("PROJECT");
    expect(
      buildWorkingCalendarTargetKey({ kind: "MEMBER", accountId: 2 })
    ).toBe("MEMBER:2");
    expect(parseWorkingCalendarTargetKey("PROJECT")).toEqual({
      kind: "PROJECT",
      accountId: null,
    });
    expect(parseWorkingCalendarTargetKey("MEMBER:2")).toEqual({
      kind: "MEMBER",
      accountId: 2,
    });
    expect(parseWorkingCalendarTargetKey("MEMBER:invalid")).toBeNull();
  });

  it("選択階層の保存済み例外を編集Formへ複製する", () => {
    const target = { kind: "MEMBER", accountId: 2 };

    expect(getWorkingDayOverride(calendarDay, target)).toEqual(memberOverride);
    expect(buildWorkingDayForm(calendarDay, target)).toEqual({
      workDate: "2026-08-22",
      dayType: "HOLIDAY",
      availableMinutes: 0,
    });
  });

  it("例外未設定日は有効な既定値を新規登録Formへ引き継ぐ", () => {
    expect(
      buildWorkingDayForm(
        { ...calendarDay, projectOverride: null, source: "DEFAULT" },
        { kind: "PROJECT", accountId: null }
      )
    ).toEqual({
      workDate: "2026-08-22",
      dayType: "HOLIDAY",
      availableMinutes: 0,
    });
  });

  it("境界を含む366日を許可し367日と逆転期間を拒否する", () => {
    expect(
      validateWorkingCalendarDateRange({
        dateFrom: "2026-01-01",
        dateTo: "2027-01-01",
      })
    ).toEqual([]);
    expect(
      validateWorkingCalendarDateRange({
        dateFrom: "2026-01-01",
        dateTo: "2027-01-02",
      })
    ).toEqual(["calendarの検索期間は366日以内にしてください。"]);
    expect(
      validateWorkingCalendarDateRange({
        dateFrom: "2026-08-23",
        dateTo: "2026-08-22",
      })
    ).toEqual(["calendar終了日は開始日以降にしてください。"]);
  });

  it("休日0分と稼働日1〜1440分だけを許可する", () => {
    expect(
      validateWorkingDayForm({
        workDate: "2026-08-22",
        dayType: "HOLIDAY",
        availableMinutes: 0,
      })
    ).toEqual([]);
    expect(
      validateWorkingDayForm({
        workDate: "2026-08-22",
        dayType: "HOLIDAY",
        availableMinutes: 60,
      })
    ).toEqual(["休日の稼働可能時間は0分にしてください。"]);
    expect(
      validateWorkingDayForm({
        workDate: "2026-08-22",
        dayType: "WORKING_DAY",
        availableMinutes: 0,
      })
    ).toEqual([
      "稼働日の稼働可能時間は1分以上1440分以下で入力してください。",
    ]);
  });

  it("検証済みFormを登録・version付き更新Requestへ変換する", () => {
    const form = {
      workDate: "2026-08-22",
      dayType: "WORKING_DAY",
      availableMinutes: 420,
    };

    expect(buildWorkingDayCreateRequest(form)).toEqual(form);
    expect(buildWorkingDayUpdateRequest(form, 4)).toEqual({
      ...form,
      version: 4,
    });
  });
});
