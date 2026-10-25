import { describe, expect, it } from "vitest";

import {
  formatRecurrenceDateTime,
  formatRecurrenceErrorCode,
  formatRecurrenceSchedule,
  getGenerationStatusColor,
  getGenerationStatusLabel,
  getRecurrenceStatusColor,
  getRecurrenceStatusLabel,
} from "@/features/task/utils/taskRecurrenceDisplay";

describe("taskRecurrenceDisplay", () => {
  it.each([
    ["DAILY", 2, [], null, "2日ごと"],
    ["MONTHLY", 1, [], 15, "1か月ごと・15日"],
    ["MONTHLY", 1, [], null, "1か月ごと・-日"],
    ["WEEKLY", 1, ["MONDAY", "FRIDAY"], null, "1週ごと・月・金"],
  ])("頻度%sを短い日本語で表示する", (frequency, interval, weekdays, monthlyDay, expected) => {
    expect(formatRecurrenceSchedule(frequency, interval, weekdays, monthlyDay)).toBe(expected);
  });

  it("規則と生成履歴の状態を表示名と色へ変換し、終了系は中立色にする", () => {
    expect(getRecurrenceStatusLabel("BLOCKED")).toBe("要修正");
    expect(getRecurrenceStatusColor("BLOCKED")).toBe("error");
    expect(getRecurrenceStatusColor("ARCHIVED")).toBe("neutral");
    expect(getGenerationStatusLabel("RETRY_WAIT")).toBe("再試行待ち");
    expect(getGenerationStatusColor("SKIPPED")).toBe("neutral");
  });

  it("既知のerror codeは説明へ、未知のcodeはそのまま、未設定は-にする", () => {
    expect(formatRecurrenceErrorCode("PROJECT_ARCHIVED")).toBe("Projectがアーカイブされています。");
    expect(formatRecurrenceErrorCode("NEW_CODE")).toBe("NEW_CODE");
    expect(formatRecurrenceErrorCode(null)).toBe("-");
  });

  it("日時が未設定なら-を表示する", () => {
    expect(formatRecurrenceDateTime(null)).toBe("-");
  });
});
