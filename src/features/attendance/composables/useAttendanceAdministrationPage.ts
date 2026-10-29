import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import AttendanceApi, {
  AttendanceApiError,
} from "@/features/attendance/api/attendanceApi";
import type {
  AttendanceCorrectionResponse,
  AttendanceCorrectionStatus,
  AttendanceDayResponse,
  AttendanceMonthListItem,
  AttendanceMonthlyExportDownload,
  AttendanceMonthResponse,
  AttendanceMonthStatus,
} from "@/features/attendance/types/attendance";
import {
  buildAttendanceMonthDateRange,
} from "@/features/attendance/utils/attendance";
import {
  ATTENDANCE_ERROR_CODES,
  ATTENDANCE_RECOVERY_PRIORITY_STATUSES,
  needsAttendanceReloadGuidance,
} from "@/features/attendance/utils/apiErrors";
import { useUserStore } from "@/features/auth/stores/user";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 勤怠管理画面の部品に付ける`data-attendance-admin-control`属性の値。
 * 承認・差戻し・締め・修正の審査の後は押したボタンが消えてフォーカスがbodyへ外れるため、
 * 一覧の同じ行（なければ「検索」）へ戻す。理由が空のときは理由の入力欄へ移す（動作確認/22_勤怠管理 G-2〜G-5）。
 */
export const ATTENDANCE_ADMIN_CONTROL = {
  /** 月次一覧の「検索」ボタン。 */
  search: "search",
  /** 修正申請一覧の「申請を検索」ボタン。 */
  correctionSearch: "correction-search",
  /** 「月次CSV」ボタン。出力中はdisabledになるため、出力の後はここへ戻す。 */
  export: "export",
  /** 月の「差戻し理由（必須）」入力欄。 */
  rejectReason: "reject-reason",
  /** 修正申請の「却下理由（必須）」入力欄。 */
  correctionRejectReason: "correction-reject-reason",
} as const;

/**
 * 月次一覧の行に付ける`data-attendance-admin-control`属性の値を作る。
 *
 * @param accountId 行のaccount ID
 * @returns 属性の値
 */
export const attendanceMonthRowControlKey = (accountId: number): string =>
  `month:${accountId}`;

/**
 * 修正申請一覧の行に付ける`data-attendance-admin-control`属性の値を作る。
 *
 * @param requestId 行の修正申請ID
 * @returns 属性の値
 */
export const attendanceCorrectionRowControlKey = (requestId: number): string =>
  `correction:${requestId}`;

/** `data-attendance-admin-control`属性の値から、その部品を探すselectorを作る。 */
const adminControlSelector = (key: string): string =>
  `[data-attendance-admin-control="${key}"]`;

/**
 * 管理一覧で全状態を対象にする選択値。選択UI（Reka UI）は空文字の選択肢を扱えないため専用値にし、
 * API呼出時に状態条件なし（`null`）へ変換する。
 */
export const ALL_ATTENDANCE_MONTH_STATUSES = "ALL";

/** 管理一覧の状態絞込み選択肢。 */
export const ATTENDANCE_MONTH_STATUS_OPTIONS = [
  { title: "すべて", value: ALL_ATTENDANCE_MONTH_STATUSES },
  { title: "下書き", value: "DRAFT" },
  { title: "提出済み", value: "SUBMITTED" },
  { title: "承認済み", value: "APPROVED" },
  { title: "差戻し", value: "REJECTED" },
  { title: "締め済み", value: "CLOSED" },
] as const;

type AttendanceMonthAction = "approve" | "reject" | "close";
type AttendanceCorrectionAction = "approve-correction" | "reject-correction";

/** 修正申請管理一覧の状態絞込み選択肢。 */
export const ATTENDANCE_CORRECTION_STATUS_OPTIONS = [
  { title: "審査待ち", value: "PENDING" },
  { title: "承認済み", value: "APPROVED" },
  { title: "却下", value: "REJECTED" },
  { title: "取消済み", value: "CANCELLED" },
] as const;

/**
 * 管理者向け勤怠月画面の検索、詳細参照、承認・差戻し・締めと競合回復を管理する。
 * 一覧と選択詳細を1 composableに置き、画面に業務遷移判断を分散させない。
 */
export const useAttendanceAdministrationPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const isLoadingDetail = ref(false);
  const isLoadingList = ref(false);
  const isLoadingCorrections = ref(false);
  const isExportingMonthlyCsv = ref(false);
  const processingAction = ref<
    AttendanceMonthAction | AttendanceCorrectionAction | null
  >(null);
  const months = ref<AttendanceMonthListItem[]>([]);
  const correctionRequests = ref<AttendanceCorrectionResponse[]>([]);
  const correctionReviewComment = ref("");
  const correctionRejectReason = ref("");
  /** 修正申請の却下理由が空のまま押されたときの、入力欄の下へ出す案内。空白以外を入力すると消す。 */
  const correctionRejectReasonError = ref("");
  watch(correctionRejectReason, (value) => {
    if (value.trim()) {
      correctionRejectReasonError.value = "";
    }
  });
  const selectedCorrection = ref<AttendanceCorrectionResponse | null>(null);
  const selectedCorrectionCurrentDay = ref<AttendanceDayResponse | null>(null);
  const selectedCorrectionStatus = ref<AttendanceCorrectionStatus>("PENDING");
  const reviewComment = ref("");
  const rejectReason = ref("");
  /** 月の差戻し理由が空のまま押されたときの、入力欄の下へ出す案内。空白以外を入力すると消す。 */
  const monthRejectReasonError = ref("");
  watch(rejectReason, (value) => {
    if (value.trim()) {
      monthRejectReasonError.value = "";
    }
  });
  const selectedAccountId = ref<number | null>(null);
  const selectedDetail = ref<AttendanceMonthResponse | null>(null);
  const selectedMonth = ref(getBusinessToday().slice(0, 7));
  const selectedStatus = ref<AttendanceMonthStatus | typeof ALL_ATTENDANCE_MONTH_STATUSES>(ALL_ATTENDANCE_MONTH_STATUSES);
  /** 状態絞込みをBackendの検索条件へ変換する。全状態の場合は条件なし。 */
  const statusFilter = computed<AttendanceMonthStatus | null>(() =>
    selectedStatus.value === ALL_ATTENDANCE_MONTH_STATUSES ? null : selectedStatus.value
  );
  const successMessage = ref("");

  const selectedListItem = computed(
    () =>
      months.value.find(
        (month) => month.accountId === selectedAccountId.value
      ) ?? null
  );
  const canReview = computed(() =>
    userStore.hasPermission("ATTENDANCE_REVIEW")
  );
  const canClose = computed(() =>
    userStore.hasPermission("ATTENDANCE_CLOSE")
  );
  const canExport = computed(() =>
    userStore.hasPermission("ATTENDANCE_EXPORT")
  );
  const canApproveOrReject = computed(
    () => canReview.value && selectedDetail.value?.statusCode === "SUBMITTED"
  );
  const canCloseMonth = computed(
    () => canClose.value && selectedDetail.value?.statusCode === "APPROVED"
  );
  const isLoading = computed(
    () =>
      isLoadingList.value ||
      isLoadingDetail.value ||
      isLoadingCorrections.value ||
      isExportingMonthlyCsv.value ||
      processingAction.value !== null
  );

  /** 初期表示月の永続化済み勤怠月を取得する。 */
  const initialize = async (): Promise<void> => {
    await Promise.all([
      loadMonths(),
      canReview.value ? loadCorrectionRequests() : Promise.resolve(),
    ]);
  };

  /** 検索条件を検査して一覧を再取得し、以前の選択詳細を破棄する。 */
  const search = async (): Promise<void> => {
    try {
      buildAttendanceMonthDateRange(selectedMonth.value);
    } catch (error: unknown) {
      errorMessages.value = [
        error instanceof Error ? error.message : "対象月が不正です。",
      ];
      return;
    }
    selectedAccountId.value = null;
    selectedDetail.value = null;
    await loadMonths();
  };

  /**
   * 選択月の全アカウント勤怠をBackendで生成し、ブラウザーの保存処理へ渡す。
   * 連打による多重downloadとpermissionのない画面からの直接呼出しを抑止する。
   */
  const downloadMonthlyCsv = async (): Promise<void> => {
    if (!canExport.value || isExportingMonthlyCsv.value) {
      return;
    }
    try {
      buildAttendanceMonthDateRange(selectedMonth.value);
    } catch (error: unknown) {
      errorMessages.value = [
        error instanceof Error ? error.message : "対象月が不正です。",
      ];
      return;
    }

    isExportingMonthlyCsv.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const download = await AttendanceApi.downloadAdministrationMonthlyCsv(
        selectedMonth.value
      );
      saveMonthlyExport(download);
      successMessage.value = "月次勤怠CSVをダウンロードしました。";
    } catch (error: unknown) {
      await handleMonthlyExportError(error);
    } finally {
      isExportingMonthlyCsv.value = false;
    }
    await focusFirstEnabledElement([adminControlSelector(ATTENDANCE_ADMIN_CONTROL.export)]);
  };

  /**
   * Backendから受け取ったCSVを一時URLへ変換し、同一画面のまま保存を開始する。
   * 使用済みURLは成否にかかわらず破棄し、長時間開く管理画面でmemoryを残さない。
   */
  const saveMonthlyExport = (
    download: AttendanceMonthlyExportDownload
  ): void => {
    const objectUrl = URL.createObjectURL(download.content);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = download.fileName;
    anchor.style.display = "none";
    try {
      document.body.appendChild(anchor);
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }
  };

  /** 選択状態の勤怠修正申請を再検索し、以前の比較対象を破棄する。 */
  const searchCorrectionRequests = async (): Promise<void> => {
    selectedCorrection.value = null;
    selectedCorrectionCurrentDay.value = null;
    correctionReviewComment.value = "";
    correctionRejectReason.value = "";
    await loadCorrectionRequests();
  };

  /** 管理一覧で選択した修正申請と現在勤怠を比較表示する。 */
  const selectCorrectionRequest = async (
    request: AttendanceCorrectionResponse
  ): Promise<void> => {
    if (isLoadingDetail.value || processingAction.value !== null) {
      return;
    }
    selectedCorrection.value = request;
    correctionReviewComment.value = "";
    correctionRejectReason.value = "";
    isLoadingDetail.value = true;
    errorMessages.value = [];
    try {
      const currentMonth = await AttendanceApi.getAdministrationMonth(
        request.accountId,
        request.workDate.slice(0, 7)
      );
      selectedCorrectionCurrentDay.value =
        currentMonth.days.find((day) => day.workDate === request.workDate) ??
        null;
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.correctionCurrentLoadFailed
      );
    } finally {
      isLoadingDetail.value = false;
    }
  };

  /** 選択中のPENDING修正申請を任意コメント付きで承認する。 */
  const approveCorrectionRequest = async (): Promise<void> => {
    const request = selectedCorrection.value;
    if (!canReview.value || request?.statusCode !== "PENDING") {
      return;
    }
    await executeCorrectionAction(
      "approve-correction",
      "勤怠修正申請を承認しました。",
      () =>
        AttendanceApi.approveCorrectionRequest(
          request.attendanceCorrectionRequestId,
          request.version,
          correctionReviewComment.value.trim() || null
        )
    );
  };

  /** 選択中のPENDING修正申請を必須理由付きで却下する。 */
  const rejectCorrectionRequest = async (): Promise<void> => {
    const request = selectedCorrection.value;
    const reason = correctionRejectReason.value.trim();
    if (!canReview.value || request?.statusCode !== "PENDING") {
      return;
    }
    if (!reason) {
      correctionRejectReasonError.value = "却下理由を入力してください。";
      await focusFirstEnabledElement([
        adminControlSelector(ATTENDANCE_ADMIN_CONTROL.correctionRejectReason),
      ]);
      return;
    }
    await executeCorrectionAction(
      "reject-correction",
      "勤怠修正申請を却下しました。",
      () =>
        AttendanceApi.rejectCorrectionRequest(
          request.attendanceCorrectionRequestId,
          request.version,
          reason
        )
    );
  };

  /** 一覧で選択したaccountの月次詳細を取得する。 */
  const selectMonth = async (month: AttendanceMonthListItem): Promise<void> => {
    if (isLoadingDetail.value || processingAction.value !== null) {
      return;
    }
    selectedAccountId.value = month.accountId;
    reviewComment.value = "";
    rejectReason.value = "";
    await loadSelectedDetail();
  };

  /** SUBMITTED月を任意コメント付きで承認する。 */
  const approve = async (): Promise<void> => {
    const detail = selectedDetail.value;
    if (
      !canApproveOrReject.value ||
      detail === null ||
      detail.attendanceMonthId === null
    ) {
      return;
    }
    const attendanceMonthId = detail.attendanceMonthId;
    await executeAction("approve", "勤怠月を承認しました。", () =>
      AttendanceApi.approveMonth(
        attendanceMonthId,
        detail.version,
        reviewComment.value.trim() || null
      )
    );
  };

  /** SUBMITTED月を入力済みの必須理由で差し戻す。 */
  const reject = async (): Promise<void> => {
    const detail = selectedDetail.value;
    const reason = rejectReason.value.trim();
    if (
      !canApproveOrReject.value ||
      detail === null ||
      detail.attendanceMonthId === null
    ) {
      return;
    }
    if (!reason) {
      // 画面上部では押した位置から見えないため、入力欄の下に出して入力欄へ移す。
      monthRejectReasonError.value = "差戻し理由を入力してください。";
      await focusFirstEnabledElement([adminControlSelector(ATTENDANCE_ADMIN_CONTROL.rejectReason)]);
      return;
    }
    const attendanceMonthId = detail.attendanceMonthId;
    await executeAction("reject", "勤怠月を差し戻しました。", () =>
      AttendanceApi.rejectMonth(
        attendanceMonthId,
        detail.version,
        reason
      )
    );
  };

  /** APPROVED月を最新versionで締める。 */
  const close = async (): Promise<void> => {
    const detail = selectedDetail.value;
    if (
      !canCloseMonth.value ||
      detail === null ||
      detail.attendanceMonthId === null
    ) {
      return;
    }
    const attendanceMonthId = detail.attendanceMonthId;
    await executeAction("close", "勤怠月を締めました。", () =>
      AttendanceApi.closeMonth(
        attendanceMonthId,
        detail.version
      )
    );
  };

  /** 現在の月・状態条件で管理一覧を取得する。 */
  const loadMonths = async (): Promise<void> => {
    if (isLoadingList.value) {
      return;
    }
    isLoadingList.value = true;
    errorMessages.value = [];
    try {
      const response = await AttendanceApi.getAdministrationMonths(
        selectedMonth.value,
        statusFilter.value
      );
      months.value = response.months;
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.monthListLoadFailed
      );
    } finally {
      isLoadingList.value = false;
    }
  };

  /** 現在の状態条件で管理対象の勤怠修正申請一覧を取得する。 */
  const loadCorrectionRequests = async (): Promise<void> => {
    if (isLoadingCorrections.value) {
      return;
    }
    isLoadingCorrections.value = true;
    errorMessages.value = [];
    try {
      const response = await AttendanceApi.getAdministrationCorrectionRequests(
        selectedCorrectionStatus.value
      );
      correctionRequests.value = response.correctionRequests;
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.correctionListLoadFailed
      );
    } finally {
      isLoadingCorrections.value = false;
    }
  };

  /** 選択中accountの対象月詳細を取得する。 */
  const loadSelectedDetail = async (): Promise<void> => {
    if (selectedAccountId.value === null) {
      return;
    }
    isLoadingDetail.value = true;
    errorMessages.value = [];
    try {
      selectedDetail.value = await AttendanceApi.getAdministrationMonth(
        selectedAccountId.value,
        selectedMonth.value
      );
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.monthDetailLoadFailed
      );
    } finally {
      isLoadingDetail.value = false;
    }
  };

  /** 更新操作を直列化し、成功後に詳細と一覧をBackend確定値へ同期する。 */
  const executeAction = async (
    action: AttendanceMonthAction,
    message: string,
    request: () => Promise<AttendanceMonthResponse>
  ): Promise<void> => {
    if (processingAction.value !== null) {
      return;
    }
    processingAction.value = action;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      selectedDetail.value = await request();
      reviewComment.value = "";
      rejectReason.value = "";
      successMessage.value = message;
      await loadMonths();
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.monthUpdateFailed
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        // version競合後は古い画面値で再実行させず、最新詳細と一覧へ戻す。
        const conflictMessages = [...errorMessages.value];
        await reloadMonthAfterConflict(conflictMessages, error);
      }
    } finally {
      processingAction.value = null;
    }
    // 状態が変わると押したボタンは消えるため、一覧の同じ行（絞り込みで消えたら「検索」）へ戻す。
    await focusFirstEnabledElement([
      adminControlSelector(action),
      ...(selectedAccountId.value === null
        ? []
        : [adminControlSelector(attendanceMonthRowControlKey(selectedAccountId.value))]),
      adminControlSelector(ATTENDANCE_ADMIN_CONTROL.search),
    ]);
  };

  /** 修正申請の審査を直列化し、結果と現在勤怠をBackend確定値へ同期する。 */
  const executeCorrectionAction = async (
    action: AttendanceCorrectionAction,
    message: string,
    request: () => Promise<AttendanceCorrectionResponse>
  ): Promise<void> => {
    if (processingAction.value !== null) {
      return;
    }
    processingAction.value = action;
    errorMessages.value = [];
    successMessage.value = "";
    const requestId = selectedCorrection.value?.attendanceCorrectionRequestId ?? null;
    try {
      selectedCorrection.value = await request();
      correctionReviewComment.value = "";
      correctionRejectReason.value = "";
      successMessage.value = message;
      await loadCorrectionRequests();
      if (selectedCorrection.value.statusCode === "APPROVED") {
        const currentMonth = await AttendanceApi.getAdministrationMonth(
          selectedCorrection.value.accountId,
          selectedCorrection.value.workDate.slice(0, 7)
        );
        selectedCorrectionCurrentDay.value =
          currentMonth.days.find(
            (day) => day.workDate === selectedCorrection.value?.workDate
          ) ?? null;
      }
    } catch (error: unknown) {
      await handleApiError(
        error,
        DISPLAY_MESSAGES.attendance.administration.correctionReviewFailed
      );
      if (error instanceof AttendanceApiError && error.status === 409) {
        // 同時審査後は古いversionを再送せず、対象状態の一覧から選択し直させる。
        const conflictMessages = [...errorMessages.value];
        await reloadCorrectionsAfterConflict(conflictMessages, error);
      }
    } finally {
      processingAction.value = null;
    }
    // 審査すると押したボタンは消え、審査待ちで絞った一覧からは行も消えるため、残っている部品へ戻す。
    await focusFirstEnabledElement([
      adminControlSelector(action),
      ...(requestId === null
        ? []
        : [adminControlSelector(attendanceCorrectionRowControlKey(requestId))]),
      adminControlSelector(ATTENDANCE_ADMIN_CONTROL.correctionSearch),
    ]);
  };

  /** API失敗をSession状態と利用者向けメッセージへ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof AttendanceApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      errorMessages.value = [];
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [
        DISPLAY_MESSAGES.attendance.administration.forbidden,
      ];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [
        DISPLAY_MESSAGES.attendance.administration.resourceNotFound,
      ];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      ATTENDANCE_ERROR_CODES,
      fallbackMessage
    );
  };

  /** 月次CSV固有の認可失敗と入力エラーを利用者向けの回復手順へ変換する。 */
  const handleMonthlyExportError = async (error: unknown): Promise<void> => {
    if (!(error instanceof AttendanceApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      errorMessages.value = [];
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [
        DISPLAY_MESSAGES.attendance.administration.exportForbidden,
      ];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      ATTENDANCE_ERROR_CODES,
      DISPLAY_MESSAGES.attendance.administration.exportFailed
    );
  };

  /**
   * 409後に選択月詳細と現在の一覧条件を再取得し、古いversionを破棄する。
   * version競合等で取り直せたときは、取り直し済みの案内を添える。
   *
   * @param conflictMessages 409で表示した競合理由
   * @param conflict 操作APIが返した409
   */
  const reloadMonthAfterConflict = async (
    conflictMessages: string[],
    conflict: AttendanceApiError
  ): Promise<void> => {
    const accountId = selectedAccountId.value;
    if (accountId === null) {
      errorMessages.value = conflictMessages;
      return;
    }
    try {
      const [detail, listResponse] = await Promise.all([
        AttendanceApi.getAdministrationMonth(accountId, selectedMonth.value),
        AttendanceApi.getAdministrationMonths(
          selectedMonth.value,
          statusFilter.value
        ),
      ]);
      selectedDetail.value = detail;
      months.value = listResponse.months;
      errorMessages.value = withReloadGuidance(conflictMessages, conflict);
    } catch (refreshError: unknown) {
      await handleConflictRefreshError(
        refreshError,
        conflictMessages,
        DISPLAY_MESSAGES.attendance.administration.monthUpdateFailed
      );
    }
  };

  /**
   * 409後に修正申請一覧を再取得し、同時審査前の選択状態を破棄する。
   * version競合等で取り直せたときは、取り直し済みの案内を添える。
   *
   * @param conflictMessages 409で表示した競合理由
   * @param conflict 審査APIが返した409
   */
  const reloadCorrectionsAfterConflict = async (
    conflictMessages: string[],
    conflict: AttendanceApiError
  ): Promise<void> => {
    selectedCorrection.value = null;
    selectedCorrectionCurrentDay.value = null;
    try {
      const response = await AttendanceApi.getAdministrationCorrectionRequests(
        selectedCorrectionStatus.value
      );
      correctionRequests.value = response.correctionRequests;
      errorMessages.value = withReloadGuidance(conflictMessages, conflict);
    } catch (refreshError: unknown) {
      await handleConflictRefreshError(
        refreshError,
        conflictMessages,
        DISPLAY_MESSAGES.attendance.administration.correctionReviewFailed
      );
    }
  };

  /**
   * 取り直しに成功した409の競合理由へ、必要なら取り直し済みの案内を添える。
   *
   * @param conflictMessages 409で表示した競合理由
   * @param conflict 操作APIが返した409
   * @returns 画面上部へ出すmessage
   */
  const withReloadGuidance = (
    conflictMessages: string[],
    conflict: AttendanceApiError
  ): string[] =>
    needsAttendanceReloadGuidance(conflict.errorResponse)
      ? [...conflictMessages, DISPLAY_MESSAGES.attendance.conflictReloaded]
      : conflictMessages;

  /** 409回復時の認証・認可・公開範囲変化だけを古い競合案内より優先する。 */
  const handleConflictRefreshError = async (
    refreshError: unknown,
    conflictMessages: string[],
    fallbackMessage: string
  ): Promise<void> => {
    if (
      refreshError instanceof AttendanceApiError &&
      ATTENDANCE_RECOVERY_PRIORITY_STATUSES.has(refreshError.status)
    ) {
      await handleApiError(refreshError, fallbackMessage);
      return;
    }
    errorMessages.value = conflictMessages;
  };

  return {
    correctionRejectReasonError,
    monthRejectReasonError,
    approve,
    approveCorrectionRequest,
    canApproveOrReject,
    canCloseMonth,
    canExport,
    canReview,
    close,
    correctionRejectReason,
    correctionRequests,
    correctionReviewComment,
    correctionStatusOptions: ATTENDANCE_CORRECTION_STATUS_OPTIONS,
    errorMessages,
    initialize,
    isExportingMonthlyCsv,
    isLoading,
    months,
    processingAction,
    reject,
    rejectCorrectionRequest,
    rejectReason,
    reviewComment,
    downloadMonthlyCsv,
    search,
    searchCorrectionRequests,
    selectCorrectionRequest,
    selectMonth,
    selectedAccountId,
    selectedCorrection,
    selectedCorrectionCurrentDay,
    selectedCorrectionStatus,
    selectedDetail,
    selectedListItem,
    selectedMonth,
    selectedStatus,
    statusOptions: ATTENDANCE_MONTH_STATUS_OPTIONS,
    successMessage,
  };
};
