import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

import { useAttendanceClock } from "@/features/attendance/composables/useAttendanceClock";

describe("useAttendanceClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("東京時刻を表示し、1秒ごとに更新する", () => {
    const scope = effectScope();
    const clock = scope.run(() => useAttendanceClock());

    expect(clock.currentTime.value).toBe("09:00:00");
    expect(clock.currentTimeAriaLabel.value).toBe("現在の東京時刻 09:00:00");

    vi.advanceTimersByTime(1_000);
    expect(clock.currentTime.value).toBe("09:00:01");
    scope.stop();
  });

  it("Component破棄に相当するscope終了後はtimerを止めて表示を更新しない", () => {
    const scope = effectScope();
    const clock = scope.run(() => useAttendanceClock());

    scope.stop();
    vi.advanceTimersByTime(5_000);

    expect(clock.currentTime.value).toBe("09:00:00");
    expect(vi.getTimerCount()).toBe(0);
  });
});
