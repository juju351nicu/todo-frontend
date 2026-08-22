import { describe, expect, it } from "vitest";

import {
  formatEffortMinutes,
  formatSignedEffortMinutes,
  isValidIsoLocalDate,
} from "@/features/wbs/utils/effort";

describe("WBS工数共通utility", () => {
  it("閏日を含む実在日だけをyyyy-MM-ddとして受け入れる", () => {
    expect(isValidIsoLocalDate("2028-02-29")).toBe(true);
    expect(isValidIsoLocalDate("2026-02-29")).toBe(false);
    expect(isValidIsoLocalDate("2026/08/22")).toBe(false);
  });

  it("分単位工数を0分・分・時間・時間分へ読みやすく整形する", () => {
    expect(formatEffortMinutes(0)).toBe("0分");
    expect(formatEffortMinutes(45)).toBe("45分");
    expect(formatEffortMinutes(120)).toBe("2時間");
    expect(formatEffortMinutes(135)).toBe("2時間15分");
    expect(formatEffortMinutes(Number.NaN)).toBe("0分");
  });

  it("予定と実績の差分へ正負記号を付けて超過方向を明示する", () => {
    expect(formatSignedEffortMinutes(90)).toBe("+1時間30分");
    expect(formatSignedEffortMinutes(-45)).toBe("-45分");
    expect(formatSignedEffortMinutes(0)).toBe("0分");
  });
});
