import { describe, expect, it } from "vitest";

import { formatShortDateTime } from "@/shared/utils/dateTime";

describe("formatShortDateTime", () => {
  it("日付と時刻を短い形式で表示する", () => {
    expect(formatShortDateTime("2026-10-26T09:05:00")).toBe("2026/10/26 9:05");
  });

  it("解釈できない値は元の文字列を返す", () => {
    expect(formatShortDateTime("invalid")).toBe("invalid");
  });
});
