import { describe, expect, it } from "vitest";

import {
  formatEarnedValueMinutes,
  formatEarnedValuePercent,
  formatEarnedValueRatio,
  formatSignedEarnedValueMinutes,
  getEarnedValueRatioColor,
  getEarnedValueVarianceColor,
  validateEarnedValueStatusDate,
  resolveEarnedValueGuidance,
} from "@/features/wbs/utils/earnedValue";

describe("EVM表示utility", () => {
  it("実在するISO日付だけをEVM基準日として受け入れる", () => {
    expect(validateEarnedValueStatusDate("2028-02-29")).toEqual([]);
    expect(validateEarnedValueStatusDate("2026-02-29")).toEqual(["EVM基準日を入力してください。"]);
    expect(validateEarnedValueStatusDate("")).toEqual(["EVM基準日を入力してください。"]);
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

  it("SPI・CPIとSV・CVの健全境界を共通の注意色へ変換する", () => {
    expect(getEarnedValueRatioColor(null)).toBeUndefined();
    expect(getEarnedValueRatioColor(Number.NaN)).toBeUndefined();
    expect(getEarnedValueRatioColor(0.9999)).toBe("error");
    expect(getEarnedValueRatioColor(1)).toBe("success");
    expect(getEarnedValueVarianceColor(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(getEarnedValueVarianceColor(-0.01)).toBe("error");
    expect(getEarnedValueVarianceColor(0)).toBe("success");
  });
});

describe("resolveEarnedValueGuidance", () => {
  it("有効なbaselineがあれば基準日の指定だけを案内する", () => {
    expect(resolveEarnedValueGuidance({ hasActiveBaseline: true, canManageBaselines: false })).toBe(
      "基準日を指定して集計してください。"
    );
  });

  it("baselineがなければ、保存できる人には保存を、できない人には依頼先を案内する", () => {
    expect(
      resolveEarnedValueGuidance({ hasActiveBaseline: false, canManageBaselines: true })
    ).toContain("現在計画を保存してください");
    expect(
      resolveEarnedValueGuidance({ hasActiveBaseline: false, canManageBaselines: false })
    ).toContain("OWNERまたはMANAGER");
  });
});
