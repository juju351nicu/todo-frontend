import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AttendanceApi, {
  AttendanceApiError,
} from "@/features/attendance/api/attendanceApi";
import type {
  AttendanceCorrectionForm,
  AttendanceCorrectionResponse,
  AttendanceDayResponse,
  AttendanceMonthResponse,
  AttendancePunchAction,
} from "@/features/attendance/types/attendance";
import {
  buildAttendanceMonthDateRange,
  buildAttendanceMonthRows,
  getTodayInTokyo,
  summarizeAttendanceDay,
} from "@/features/attendance/utils/attendance";
import {
  buildAttendanceCorrectionForm,
  buildAttendanceCorrectionRequest,
  validateAttendanceCorrectionForm,
} from "@/features/attendance/utils/attendanceCorrection";
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
  const isSubmittingMonth = ref(false);
  const isSubmittingCorrection = ref(false);
  const cancellingCorrectionId = ref<number | null>(null);
  const isCorrectionDialogOpen = ref(false);
  const correctionRequests = ref<AttendanceCorrectionResponse[]>([]);
  const correctionForm = ref<AttendanceCorrectionForm>({
    note: "",
    reason: "",
    workPeriods: [],
  });
  const monthDays = ref<AttendanceDayResponse[]>([]);
  const monthSummary = ref<AttendanceMonthResponse | null>(null);
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
  const currentUserDisplayName = computed(
    () => userStore.displayName || userStore.username || "ログイン利用者"
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
  const canSubmitMonth = computed(
    () =>
      canWriteAttendance.value &&
      !isSubmittingMonth.value &&
      !monthSummary.value?.hasIncompletePeriod &&
      ["DRAFT", "REJECTED"].includes(monthSummary.value?.statusCode ?? "")
  );
  const hasPendingCorrection = computed(() =>
    correctionRequests.value.some((request) => request.statusCode === "PENDING")
  );
  const canRequestCorrection = computed(
    () =>
      canWriteAttendance.value &&
      !selectedDaySummary.value.incomplete &&
      !hasPendingCorrection.value &&
      ["APPROVED", "CLOSED"].includes(monthSummary.value?.statusCode ?? "")
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

  /** 表示月を最新versionで提出または再提出し、Backend確定状態へ同期する。 */
  const submitMonth = async (): Promise<void> => {
    if (!canSubmitMonth.value || monthSummary.value === null) {
      return;
    }
    isSubmittingMonth.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      monthSummary.value = await AttendanceApi.submitMonth(
        selectedMonth.value,
        monthSummary.value.version
      );
      monthDays.value = monthSummary.value.days;
      successMessage.value = "月次勤怠を提出しました。";
    } catch (error: unknown) {
      await handleApiError(error, "月次勤怠を提出できませんでした。");
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict();
      }
    } finally {
      isSubmittingMonth.value = false;
    }
  };

  /** 選択日の現在値を全置換フォームへ複製して修正申請dialogを開く。 */
  const openCorrectionDialog = (): void => {
    if (!canRequestCorrection.value || selectedDay.value === null) {
      return;
    }
    correctionForm.value = buildAttendanceCorrectionForm(selectedDay.value);
    isCorrectionDialogOpen.value = true;
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 未送信の修正入力を破棄してdialogを閉じる。 */
  const closeCorrectionDialog = (): void => {
    if (!isSubmittingCorrection.value) {
      isCorrectionDialogOpen.value = false;
    }
  };

  /** 修正申請フォームへ空の勤務区間を末尾追加する。 */
  const addCorrectionWorkPeriod = (): void => {
    if (correctionForm.value.workPeriods.length >= 20) {
      return;
    }
    correctionForm.value.workPeriods.push({
      startedAt: `${selectedWorkDate.value}T09:00:00`,
      endedAt: `${selectedWorkDate.value}T18:00:00`,
      breakPeriods: [],
    });
  };

  /** 修正申請フォームから指定順の勤務区間を削除する。 */
  const removeCorrectionWorkPeriod = (workIndex: number): void => {
    correctionForm.value.workPeriods.splice(workIndex, 1);
  };

  /** 指定勤務区間へ空の休憩区間を末尾追加する。 */
  const addCorrectionBreakPeriod = (workIndex: number): void => {
    const workPeriod = correctionForm.value.workPeriods[workIndex];
    if (!workPeriod || workPeriod.breakPeriods.length >= 20) {
      return;
    }
    workPeriod.breakPeriods.push({
      startedAt: `${selectedWorkDate.value}T12:00:00`,
      endedAt: `${selectedWorkDate.value}T13:00:00`,
    });
  };

  /** 指定勤務区間から指定順の休憩区間を削除する。 */
  const removeCorrectionBreakPeriod = (
    workIndex: number,
    breakIndex: number
  ): void => {
    correctionForm.value.workPeriods[workIndex]?.breakPeriods.splice(
      breakIndex,
      1
    );
  };

  /** 指定勤務区間の開始または終了入力を、存在する行にだけ反映する。 */
  const updateCorrectionWorkPeriod = (
    workIndex: number,
    field: "startedAt" | "endedAt",
    value: string
  ): void => {
    const workPeriod = correctionForm.value.workPeriods[workIndex];
    if (workPeriod) {
      workPeriod[field] = value;
    }
  };

  /** 指定休憩区間の開始または終了入力を、存在する行にだけ反映する。 */
  const updateCorrectionBreakPeriod = (
    workIndex: number,
    breakIndex: number,
    field: "startedAt" | "endedAt",
    value: string
  ): void => {
    const breakPeriod =
      correctionForm.value.workPeriods[workIndex]?.breakPeriods[breakIndex];
    if (breakPeriod) {
      breakPeriod[field] = value;
    }
  };

  /** 1勤務日全体の修正snapshotを検証し、審査待ちとして申請する。 */
  const submitCorrectionRequest = async (): Promise<void> => {
    if (
      isSubmittingCorrection.value ||
      !canRequestCorrection.value ||
      selectedDay.value === null
    ) {
      return;
    }
    const validationMessages = validateAttendanceCorrectionForm(
      selectedWorkDate.value,
      correctionForm.value
    );
    if (validationMessages.length > 0) {
      errorMessages.value = validationMessages;
      return;
    }
    isSubmittingCorrection.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await AttendanceApi.createCorrectionRequest(
        selectedWorkDate.value,
        buildAttendanceCorrectionRequest(
          selectedDay.value,
          correctionForm.value
        )
      );
      await loadCorrectionRequests();
      isCorrectionDialogOpen.value = false;
      successMessage.value = "勤怠修正を申請しました。";
    } catch (error: unknown) {
      await handleApiError(error, "勤怠修正を申請できませんでした。");
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict();
      }
    } finally {
      isSubmittingCorrection.value = false;
    }
  };

  /** 審査前の本人修正申請を最新versionで取り消す。 */
  const cancelCorrectionRequest = async (
    request: AttendanceCorrectionResponse
  ): Promise<void> => {
    if (
      cancellingCorrectionId.value !== null ||
      request.statusCode !== "PENDING"
    ) {
      return;
    }
    cancellingCorrectionId.value = request.attendanceCorrectionRequestId;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      await AttendanceApi.cancelCorrectionRequest(
        request.attendanceCorrectionRequestId,
        request.version
      );
      await loadCorrectionRequests();
      successMessage.value = "勤怠修正申請を取り消しました。";
    } catch (error: unknown) {
      await handleApiError(error, "勤怠修正申請を取り消せませんでした。");
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict();
      }
    } finally {
      cancellingCorrectionId.value = null;
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
      const [listResponse, dayResponse, monthResponse, correctionResponse] =
        await Promise.all([
          AttendanceApi.getDays(dateRange.dateFrom, dateRange.dateTo),
          AttendanceApi.getDay(selectedWorkDate.value),
          AttendanceApi.getMonth(selectedMonth.value),
          AttendanceApi.getOwnCorrectionRequests(selectedWorkDate.value),
        ]);
      monthDays.value = listResponse.days;
      selectedDay.value = dayResponse;
      monthSummary.value = monthResponse;
      correctionRequests.value = correctionResponse.correctionRequests;
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
      const [listResponse, monthResponse] = await Promise.all([
        AttendanceApi.getDays(dateRange.dateFrom, dateRange.dateTo),
        AttendanceApi.getMonth(selectedMonth.value),
      ]);
      monthDays.value = listResponse.days;
      monthSummary.value = monthResponse;
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
      const [dayResponse, correctionResponse] = await Promise.all([
        AttendanceApi.getDay(selectedWorkDate.value),
        AttendanceApi.getOwnCorrectionRequests(selectedWorkDate.value),
      ]);
      selectedDay.value = dayResponse;
      correctionRequests.value = correctionResponse.correctionRequests;
    } catch (error: unknown) {
      await handleApiError(error, "選択日の勤怠を取得できませんでした。");
    } finally {
      isLoadingDay.value = false;
    }
  };

  /** 選択日の本人修正申請履歴だけを再取得する。 */
  const loadCorrectionRequests = async (): Promise<void> => {
    const response = await AttendanceApi.getOwnCorrectionRequests(
      selectedWorkDate.value
    );
    correctionRequests.value = response.correctionRequests;
  };

  /** 409後に月一覧と選択日を再取得し、次に可能な打刻操作を確定する。 */
  const reloadAfterConflict = async (): Promise<void> => {
    try {
      const dateRange = buildAttendanceMonthDateRange(selectedMonth.value);
      const [listResponse, dayResponse, monthResponse, correctionResponse] =
        await Promise.all([
          AttendanceApi.getDays(dateRange.dateFrom, dateRange.dateTo),
          AttendanceApi.getDay(selectedWorkDate.value),
          AttendanceApi.getMonth(selectedMonth.value),
          AttendanceApi.getOwnCorrectionRequests(selectedWorkDate.value),
        ]);
      monthDays.value = listResponse.days;
      selectedDay.value = dayResponse;
      monthSummary.value = monthResponse;
      correctionRequests.value = correctionResponse.correctionRequests;
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
    addCorrectionBreakPeriod,
    addCorrectionWorkPeriod,
    cancelCorrectionRequest,
    cancellingCorrectionId,
    canRequestCorrection,
    canSubmitMonth,
    canClockIn,
    canClockOut,
    canEndBreak,
    canStartBreak,
    canWriteAttendance,
    changeMonth,
    closeCorrectionDialog,
    correctionForm,
    correctionRequests,
    currentUserDisplayName,
    errorMessages,
    executePunch,
    submitMonth,
    initialize,
    isCorrectionDialogOpen,
    isLoading,
    isPunching,
    isSubmittingMonth,
    isSubmittingCorrection,
    monthSummary,
    monthRows,
    openCorrectionDialog,
    removeCorrectionBreakPeriod,
    removeCorrectionWorkPeriod,
    selectWorkDate,
    selectedDay,
    selectedDaySummary,
    selectedMonth,
    selectedWorkDate,
    successMessage,
    submitCorrectionRequest,
    today,
    updateCorrectionBreakPeriod,
    updateCorrectionWorkPeriod,
  };
};
