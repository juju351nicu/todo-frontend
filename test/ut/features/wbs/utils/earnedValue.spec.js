import { describe, expect, it } from "vitest";

import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
  validateEarnedValueStatusDate,
} from "@/features/wbs/utils/earnedValue";

describe("EVM表示utility", () => {
  it("実在するISO日付だけをEVM基準日として受け入れる", () => {
    expect(validateEarnedValueStatusDate("2028-02-29")).toEqual([]);
    expect(validateEarnedValueStatusDate("2026-02-29")).toEqual([
      "EVM基準日を入力してください。",
    ]);
    expect(validateEarnedValueStatusDate("")).toEqual([
      "EVM基準日を入力してください。",
    ]);
  });

  it("Backend確定済み分値を小数第2位まで整形して正負方向を残す", () => {
    expect(formatEarnedValueMinutes(1234.5)).toBe("1,234.5分");
    expect(formatSignedEarnedValueMinutes(60.25)).toBe("+60.25分");
    expect(formatSignedEarnedValueMinutes(-30)).toBe("-30分");
    expect(formatEarnedValueMinutes(Number.NaN)).toBe("—");
  });

  it("SPI・CPIと進捗率のnullable契約を算出対象外として表示する", () => {
    expect(formatEarnedValueRatio(0.98765)).toBe("0.9877");
    expect(formatEarnedValueRatio(null)).toBe("算出対象外");
    expect(formatEarnedValuePercent(42.125)).toBe("42.13%");
    expect(formatEarnedValuePercent(null)).toBe("算出対象外");
  });
});
