import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AttendanceApi, {
  AttendanceApiError,
} from "@/features/attendance/api/attendanceApi";
import type {
  AttendanceDayResponse,
  AttendancePunchAction,
} from "@/features/attendance/types/attendance";
import {
  buildAttendanceMonthDateRange,
  buildAttendanceMonthRows,
  getTodayInTokyo,
  summarizeAttendanceDay,
} from "@/features/attendance/utils/attendance";
import { useUserStore } from "@/features/auth/stores/user";

const PUNCH_SUCCESS_MESSAGES: Record<AttendancePunchAction, string> = {
  "clock-in": "出勤を記録しました。",
  "clock-out": "退勤を記録しました。",
  "break-start": "休憩開始を記録しました。",
  "break-end": "休憩終了を記録しました。",
};

/**
 * 本人勤怠画面の月一覧、選択日詳細、server timestamp打刻、競合回復を管理する。
 * 月一覧は1回の期間APIで取得し、日ごとのN+1 Requestを発生させない。
 */
export const useAttendancePage = () => {
  const router = useRouter();
  const userStore = useUserStore();
  const today = getTodayInTokyo();

  const errorMessages = ref<string[]>([]);
  const isLoadingDay = ref(false);
  const isLoadingMonth = ref(false);
  const isPunching = ref(false);
  const monthDays = ref<AttendanceDayResponse[]>([]);
  const selectedDay = ref<AttendanceDayResponse | null>(null);
  const selectedMonth = ref(today.slice(0, 7));
  const selectedWorkDate = ref(today);
  const successMessage = ref("");

  const monthRows = computed(() =>
    buildAttendanceMonthRows(selectedMonth.value, monthDays.value)
  );
  const selectedDaySummary = computed(() =>
    summarizeAttendanceDay(selectedDay.value)
  );
  const canWriteAttendance = computed(() =>
    userStore.hasPermission("ATTENDANCE_WRITE_OWN")
  );
  const canClockIn = computed(
    () =>
      canWriteAttendance.value &&
      selectedWorkDate.value === today &&
      selectedDay.value?.punchState === "OFF_DUTY"
  );
  const canClockOut = computed(
    () =>
      canWriteAttendance.value && selectedDay.value?.punchState === "WORKING"
  );
  const canStartBreak = computed(
    () =>
      canWriteAttendance.value && selectedDay.value?.punchState === "WORKING"
  );
  const canEndBreak = computed(
    () =>
      canWriteAttendance.value && selectedDay.value?.punchState === "ON_BREAK"
  );
  const isLoading = computed(
    () => isLoadingMonth.value || isLoadingDay.value
  );

  /** 初期表示月と本日の詳細をBackendから取得する。 */
  const initialize = async (): Promise<void> => {
    await loadMonthAndSelectedDay();
  };

  /** 表示月を変更し、月初日を選択して一覧と詳細を再取得する。 */
  const changeMonth = async (yearMonth: string): Promise<void> => {
    try {
      const dateRange = buildAttendanceMonthDateRange(yearMonth);
      selectedMonth.value = yearMonth;
      selectedWorkDate.value = dateRange.dateFrom;
      await loadMonthAndSelectedDay();
    } catch (error: unknown) {
      errorMessages.value = [
        error instanceof Error
          ? error.message
          : "表示月を変更できませんでした。",
      ];
    }
  };

  /** 月一覧で選択した勤務日の詳細を取得する。 */
  const selectWorkDate = async (workDate: string): Promise<void> => {
    if (!monthRows.value.some((row) => row.workDate === workDate)) {
      return;
    }
    selectedWorkDate.value = workDate;
    await loadSelectedDay();
  };

  /** 出勤・退勤・休憩打刻を二重送信せずserver timestampで確定する。 */
  const executePunch = async (action: AttendancePunchAction): Promise<void> => {
    if (isPunching.value) {
      return;
    }
    isPunching.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const response = await AttendanceApi.punch(action);
      // 日跨ぎ勤務ではBackendが確定した勤務日へ表示対象を同期する。
      selectedWorkDate.value = response.workDate;
      selectedMonth.value = response.workDate.slice(0, 7);
      selectedDay.value = response;
      successMessage.value = PUNCH_SUCCESS_MESSAGES[action];
      await loadMonthDays();
    } catch (error: unknown) {
      await handleApiError(error, "打刻を確定できませんでした。");
      if (error instanceof AttendanceApiError && error.status === 409) {
        // 競合後のボタン状態を推測せず、Backendの最新状態へ戻す。
        await reloadAfterConflict();
      }
    } finally {
      isPunching.value = false;
    }
  };

  /** 現在の表示月一覧と選択日詳細を同時に取得する。 */
  const loadMonthAndSelectedDay = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoadingMonth.value = true;
    isLoadingDay.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const dateRange = buildAttendanceMonthDateRange(selectedMonth.value);
      const [listResponse, dayResponse] = await Promise.all([
        AttendanceApi.getDays(dateRange.dateFrom, dateRange.dateTo),
        AttendanceApi.getDay(selectedWorkDate.value),
      ]);
      monthDays.value = listResponse.days;
      selectedDay.value = dayResponse;
    } catch (error: unknown) {
      await handleApiError(error, "勤怠情報を取得できませんでした。");
    } finally {
      isLoadingMonth.value = false;
      isLoadingDay.value = false;
    }
  };

  /** 現在の表示月に登録済みの本人勤怠日を一括取得する。 */
  const loadMonthDays = async (): Promise<void> => {
    isLoadingMonth.value = true;
    try {
      const dateRange = buildAttendanceMonthDateRange(selectedMonth.value);
      const response = await AttendanceApi.getDays(
        dateRange.dateFrom,
        dateRange.dateTo
      );
      monthDays.value = response.days;
    } catch (error: unknown) {
      await handleApiError(error, "月間勤怠を更新できませんでした。");
    } finally {
      isLoadingMonth.value = false;
    }
  };

  /** 選択日の本人勤怠詳細を取得する。 */
  const loadSelectedDay = async (): Promise<void> => {
    if (isLoadingDay.value) {
      return;
    }
    isLoadingDay.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      selectedDay.value = await AttendanceApi.getDay(selectedWorkDate.value);
    } catch (error: unknown) {
      await handleApiError(error, "選択日の勤怠を取得できませんでした。");
    } finally {
      isLoadingDay.value = false;
    }
  };

  /** 409後に月一覧と選択日を再取得し、次に可能な打刻操作を確定する。 */
  const reloadAfterConflict = async (): Promise<void> => {
    try {
      const dateRange = buildAttendanceMonthDateRange(selectedMonth.value);
      const [listResponse, dayResponse] = await Promise.all([
        AttendanceApi.getDays(dateRange.dateFrom, dateRange.dateTo),
        AttendanceApi.getDay(selectedWorkDate.value),
      ]);
      monthDays.value = listResponse.days;
      selectedDay.value = dayResponse;
    } catch (_refreshError: unknown) {
      // 最初の409理由を残し、復旧取得失敗による曖昧な上書きを避ける。
    }
  };

  /** 本人勤怠API失敗を認証状態と利用者向け画面メッセージへ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof AttendanceApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["本人勤怠を操作するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = ["勤怠対象のアカウントが見つかりません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value =
      fieldMessages.length > 0 ? fieldMessages : [fallbackMessage];
  };

  return {
    canClockIn,
    canClockOut,
    canEndBreak,
    canStartBreak,
    canWriteAttendance,
    changeMonth,
    errorMessages,
    executePunch,
    initialize,
    isLoading,
    isPunching,
    monthRows,
    selectWorkDate,
    selectedDay,
    selectedDaySummary,
    selectedMonth,
    selectedWorkDate,
    successMessage,
    today,
  };
};
