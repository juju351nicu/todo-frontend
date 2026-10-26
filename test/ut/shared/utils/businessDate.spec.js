import { afterEach, describe, expect, it, vi } from "vitest";

import { getBusinessMonthRange, getBusinessToday } from "@/shared/utils/businessDate";

describe("業務日（Asia/Tokyo）", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    // UTCでは前日でも、東京ではすでに翌日になっている時刻。
    ["2026-08-21T15:00:00Z", "2026-08-22"],
    ["2026-08-21T14:59:59Z", "2026-08-21"],
    // 年の境界。
    ["2026-12-31T15:00:00Z", "2027-01-01"],
  ])("%sの業務日は%s", (instant, expected) => {
    expect(getBusinessToday(new Date(instant))).toBe(expected);
  });

  it.each([
    ["2026-08-31T15:00:00Z", "2026-09-01", "2026-09-30"],
    ["2028-02-10T00:00:00Z", "2028-02-01", "2028-02-29"],
    ["2026-02-10T00:00:00Z", "2026-02-01", "2026-02-28"],
    ["2026-12-31T15:00:00Z", "2027-01-01", "2027-01-31"],
  ])("%sを含む業務月は%s〜%s", (instant, dateFrom, dateTo) => {
    expect(getBusinessMonthRange(new Date(instant))).toEqual({ dateFrom, dateTo });
  });

  it("引数を省略すると現在時刻の業務日・業務月を使う", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T15:30:00Z"));

    expect(getBusinessToday()).toBe("2026-09-01");
    expect(getBusinessMonthRange()).toEqual({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });
  });
});
