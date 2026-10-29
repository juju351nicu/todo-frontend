import { computed, ref } from "vue";
import type { Ref } from "vue";
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
  summarizeAttendanceDay,
} from "@/features/attendance/utils/attendance";
import {
  buildAttendanceCorrectionForm,
  buildAttendanceCorrectionRequest,
  validateAttendanceCorrectionForm,
} from "@/features/attendance/utils/attendanceCorrection";
import {
  ATTENDANCE_ERROR_CODES,
  ATTENDANCE_RECOVERY_PRIORITY_STATUSES,
  needsAttendanceReloadGuidance,
} from "@/features/attendance/utils/apiErrors";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";
import type { StatusAlertType } from "@/shared/types/color";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { getBusinessToday } from "@/shared/utils/businessDate";

const PUNCH_SUCCESS_MESSAGES: Record<AttendancePunchAction, string> = {
  "clock-in": "出勤を記録しました。",
  "clock-out": "退勤を記録しました。",
  "break-start": "休憩開始を記録しました。",
  "break-end": "休憩終了を記録しました。",
};

/**
 * 打刻ボタンに付ける`data-attendance-punch`属性の値（打刻操作名と同じ）を、画面の並び順で並べたもの。
 * 打刻すると押したボタンがdisabledになりフォーカスがbodyへ外れるため、打刻の後は次に押せるボタンへ移す
 * （動作確認/21_勤怠本人 G-2）。
 */
const PUNCH_FOCUS_ORDER: readonly AttendancePunchAction[] = [
  "clock-in",
  "clock-out",
  "break-start",
  "break-end",
];

/**
 * 本人勤怠画面の部品に付ける`data-attendance-control`属性の値。
 * 押したボタンが消える操作（提出・修正申請・申請取消）の後に、フォーカスがbodyへ外れないよう次の部品へ移す
 * （動作確認/21_勤怠本人 G-6〜G-8）。
 */
export const ATTENDANCE_CONTROL = {
  /** 画面見出しの「表示月」入力欄。提出の後、「提出」が消えたときの戻り先。 */
  month: "month",
  /** 月次申請の「提出」「再提出」ボタン。 */
  submitMonth: "submit-month",
  /** 選択日の「修正申請」ボタン。審査待ちの申請がある間は出ないため、申請取消の後の戻り先。 */
  requestCorrection: "request-correction",
  /** 審査待ちの修正申請の「申請取消」ボタン（1勤務日に審査待ちは1件だけ）。修正申請の後の戻り先。 */
  cancelCorrection: "cancel-correction",
} as const;

/** `data-attendance-control`属性の値から、その部品を探すselectorを作る。 */
const buildAttendanceControlSelector = createDataAttributeSelector("data-attendance-control");

/** `data-attendance-punch`属性の値から、その打刻ボタンを探すselectorを作る。 */
const buildPunchButtonSelector = (action: AttendancePunchAction): string =>
  createDataAttributeSelector("data-attendance-punch")(action);

/**
 * 本人勤怠画面の月一覧、選択日詳細、server timestamp打刻、競合回復を管理する。
 * 月一覧は1回の期間APIで取得し、日ごとのN+1 Requestを発生させない。
 */
export const useAttendancePage = () => {
  const router = useRouter();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();
  const today = getBusinessToday();

  const errorMessages = ref<string[]>([]);
  /** 修正申請Dialogの入力チェック・申請APIの失敗。Dialogを開いている間は画面上部が隠れるため、Dialogの中へ出す。 */
  const correctionErrorMessages = ref<string[]>([]);
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
  /** 選択日のTask実績照合結果を示すalert種別。一致は成功、過配賦はエラー、未配賦・勤怠未確定は警告。 */
  const selectedDayAllocationAlertType = computed<StatusAlertType>(() => {
    const status = selectedDay.value?.allocationStatus;
    if (status === "BALANCED") {
      return "success";
    }
    return status === "OVER_ALLOCATED" ? "error" : "warning";
  });
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
  /**
   * 選択日に修正申請できない理由（改善提案 1-22）。ボタンを出さないだけでは理由が分からないため、日の詳細に添える。
   * 修正申請は承認済み・締め済みの月だけが対象（`docs/attendance-mvp-design.md`「修正申請」）。
   * 勤怠の更新permissionがない利用者、申請できる日、月の情報を取得していない間は空文字。
   */
  const correctionUnavailableReason = computed<string>(() => {
    const monthStatus = monthSummary.value?.statusCode;
    if (!canWriteAttendance.value || monthStatus === undefined || canRequestCorrection.value) {
      return "";
    }
    if (monthStatus === "DRAFT" || monthStatus === "REJECTED") {
      return "提出前の月は、打刻で直してから提出してください。修正申請は承認・締めの後に使えます。";
    }
    if (monthStatus === "SUBMITTED") {
      return "提出した月は審査中です。修正申請は承認の後に使えます。";
    }
    if (hasPendingCorrection.value) {
      return "この日には審査待ちの修正申請があります。結果が出るまで新しい申請はできません。";
    }
    if (selectedDaySummary.value.incomplete) {
      return "勤務・休憩が終わっていない日は修正申請できません。";
    }
    return "";
  });

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
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.punchFailed
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        // 競合後のボタン状態を推測せず、Backendの最新状態へ戻す。
        await reloadAfterConflict(error);
      }
    } finally {
      isPunching.value = false;
    }
    // 押したボタンが押せるまま（失敗等）ならそこへ、押せなくなったら画面の並び順で最初に押せるボタンへ戻す。
    await focusFirstEnabledElement(
      [action, ...PUNCH_FOCUS_ORDER].map(buildPunchButtonSelector)
    );
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
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.submitMonthFailed
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict(error);
      }
    } finally {
      isSubmittingMonth.value = false;
    }
    await focusFirstEnabledElement([
      buildAttendanceControlSelector(ATTENDANCE_CONTROL.submitMonth),
      buildAttendanceControlSelector(ATTENDANCE_CONTROL.month),
    ]);
  };

  /** 選択日の現在値を全置換フォームへ複製して修正申請dialogを開く。 */
  const openCorrectionDialog = (): void => {
    if (!canRequestCorrection.value || selectedDay.value === null) {
      return;
    }
    correctionForm.value = buildAttendanceCorrectionForm(selectedDay.value);
    isCorrectionDialogOpen.value = true;
    errorMessages.value = [];
    correctionErrorMessages.value = [];
    successMessage.value = "";
  };

  /** 未送信の修正入力を破棄してdialogを閉じる。 */
  const closeCorrectionDialog = (): void => {
    if (!isSubmittingCorrection.value) {
      isCorrectionDialogOpen.value = false;
      correctionErrorMessages.value = [];
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
      correctionErrorMessages.value = validationMessages;
      return;
    }
    isSubmittingCorrection.value = true;
    errorMessages.value = [];
    correctionErrorMessages.value = [];
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
      // 審査待ちの間は「修正申請」が消えるため、Dialogを開いたボタンの代わりに新しい申請の「申請取消」へ移す。
      await focusFirstEnabledElement([
        buildAttendanceControlSelector(ATTENDANCE_CONTROL.cancelCorrection),
        buildAttendanceControlSelector(ATTENDANCE_CONTROL.month),
      ]);
    } catch (error: unknown) {
      // Dialogは開いたままなので、理由は画面の後ろでなくDialogの中へ出す。
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.correctionRequestFailed,
        correctionErrorMessages
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict(error, correctionErrorMessages);
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
      // 押した「申請取消」は消えるため、再び出る「修正申請」（承認済み・締め済みの月だけ）へ移す。
      await focusFirstEnabledElement([
        buildAttendanceControlSelector(ATTENDANCE_CONTROL.requestCorrection),
        buildAttendanceControlSelector(ATTENDANCE_CONTROL.month),
      ]);
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.correctionCancelFailed
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        await reloadAfterConflict(error);
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
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.loadFailed
      );
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
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.monthRefreshFailed
      );
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
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.self.dayLoadFailed
      );
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

  /**
   * 409後に月一覧と選択日を再取得し、次に可能な打刻操作を確定する。
   * 認証・認可・公開範囲の変化は優先し、それ以外の再取得失敗では最初の競合理由を維持する。
   * version競合等（`needsAttendanceReloadGuidance`）で取り直せたときは、取り直し済みの案内を添える。
   *
   * @param conflict 操作APIが返した409
   * @param messageTarget 競合理由を出した先。修正申請Dialogからの409は`correctionErrorMessages`
   */
  const reloadAfterConflict = async (
    conflict: AttendanceApiError,
    messageTarget: Ref<string[]> = errorMessages
  ): Promise<void> => {
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
      if (needsAttendanceReloadGuidance(conflict.errorResponse)) {
        messageTarget.value = [
          ...messageTarget.value,
          DISPLAY_MESSAGES.attendance.conflictReloaded,
        ];
      }
    } catch (refreshError: unknown) {
      if (
        refreshError instanceof AttendanceApiError &&
        ATTENDANCE_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
      ) {
        // Session・permission・公開範囲の変化は、古い409より新しい取得結果を優先する。
        await handleApiError(
          refreshError,
          DISPLAY_MESSAGES.attendance.self.loadFailed
        );
      }
    }
  };

  /**
   * 本人勤怠API失敗を認証状態と利用者向け画面メッセージへ変換する。
   *
   * @param error API呼出しで発生した例外
   * @param fallbackMessage 契約済みmessageがない失敗で表示する案内
   * @param messageTarget 案内の表示先。既定は画面上部、修正申請Dialogからの失敗は`correctionErrorMessages`
   */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string,
    messageTarget: Ref<string[]> = errorMessages
  ): Promise<void> => {
    if (!(error instanceof AttendanceApiError)) {
      messageTarget.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      errorMessages.value = [];
      correctionErrorMessages.value = [];
      isCorrectionDialogOpen.value = false;
      await expireSession();
      return;
    }
    if (error.status === 403) {
      messageTarget.value = [DISPLAY_MESSAGES.attendance.self.forbidden];
      return;
    }
    if (error.status === 404) {
      messageTarget.value = [
        DISPLAY_MESSAGES.attendance.self.accountNotFound,
      ];
      return;
    }
    messageTarget.value = resolveApiErrorMessages(
      error.errorResponse,
      ATTENDANCE_ERROR_CODES,
      fallbackMessage
    );
  };

  /**
   * 承認済み・締め済みの月で、選択日に審査待ちの修正申請があるか。
   * Backendは同じ勤務日の審査待ち申請がある間は再申請を受け付けないため、画面で理由を案内する。
   */
  const hasPendingCorrectionInReviewedMonth = computed<boolean>(
    () =>
      (monthSummary.value?.statusCode === "APPROVED" || monthSummary.value?.statusCode === "CLOSED") &&
      correctionRequests.value.some((request) => request.statusCode === "PENDING")
  );

  return {
    addCorrectionBreakPeriod,
    addCorrectionWorkPeriod,
    cancelCorrectionRequest,
    cancellingCorrectionId,
    canRequestCorrection,
    correctionUnavailableReason,
    canSubmitMonth,
    canClockIn,
    canClockOut,
    canEndBreak,
    canStartBreak,
    canWriteAttendance,
    changeMonth,
    closeCorrectionDialog,
    correctionErrorMessages,
    correctionForm,
    correctionRequests,
    currentUserDisplayName,
    errorMessages,
    hasPendingCorrectionInReviewedMonth,
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
    selectedDayAllocationAlertType,
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
