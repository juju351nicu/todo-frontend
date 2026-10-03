import { describe, expect, it } from "vitest";

import {
  buildDefaultTimerHistoryRange,
  calculateDisplayedElapsedSeconds,
  formatEffortMinutes,
  formatElapsedSeconds,
  getTimerSessionStatusLabel,
  getWorkLogAuditActionLabel,
} from "@/features/time-tracking/utils/timeTracking";

describe("timeTracking表示utility", () => {
  it("Backend経過秒へ受信後の経過だけを加算し時計巻戻りは無視する", () => {
    expect(calculateDisplayedElapsedSeconds(59, 1_000, 3_999)).toBe(61);
    expect(calculateDisplayedElapsedSeconds(59, 3_000, 1_000)).toBe(59);
    expect(calculateDisplayedElapsedSeconds(-10, 3_000, 1_000)).toBe(0);
  });

  it("24時間以上を含む経過秒をHH:mm:ssへ変換する", () => {
    expect(formatElapsedSeconds(0)).toBe("00:00:00");
    expect(formatElapsedSeconds(3_661)).toBe("01:01:01");
    expect(formatElapsedSeconds(90_061)).toBe("25:01:01");
  });

  it("工数分、状態、監査操作を利用者向け表示へ変換する", () => {
    expect(formatEffortMinutes(0)).toBe("0分");
    expect(formatEffortMinutes(90)).toBe("1時間30分");
    expect(getTimerSessionStatusLabel("CANCELED")).toBe("取消済み");
    expect(getWorkLogAuditActionLabel("TIMER_APPLY")).toBe("Timer反映");
  });

  it("Timer履歴の初期期間をAsia Tokyo基準の30日間にする", () => {
    expect(
      buildDefaultTimerHistoryRange(new Date("2026-10-03T03:00:00Z"))
    ).toEqual({ dateFrom: "2026-09-04", dateTo: "2026-10-03" });
  });
});
