import { computed, onScopeDispose, ref } from "vue";
import type { ComputedRef, Ref } from "vue";

import { formatAttendanceClockTime } from "@/features/attendance/utils/attendance";

/** 打刻パネルの表示用時計。 */
export interface AttendanceClock {
  /** Asia/TokyoのHH:mm:ss。mount後は1秒ごとに更新する。 */
  currentTime: Ref<string>;
  /** 時計要素の読み上げ用label。 */
  currentTimeAriaLabel: ComputedRef<string>;
}

const CLOCK_INTERVAL_MILLISECONDS = 1_000;

/**
 * 打刻パネルに表示する東京時刻を毎秒更新する。
 *
 * 表示専用であり、打刻時刻はBackendが確定する。timerは呼出時に開始し、呼び出したComponentの破棄
 * （effect scopeの終了）で必ず停止する。Componentの`setup`内から呼び出すこと。
 */
export const useAttendanceClock = (): AttendanceClock => {
  const currentTime = ref<string>(formatAttendanceClockTime());
  const currentTimeAriaLabel = computed<string>(() => `現在の東京時刻 ${currentTime.value}`);
  const clockTimer = setInterval(() => {
    currentTime.value = formatAttendanceClockTime();
  }, CLOCK_INTERVAL_MILLISECONDS);

  // 画面遷移後に不要なtimerを残さない。
  onScopeDispose(() => clearInterval(clockTimer));

  return { currentTime, currentTimeAriaLabel };
};
