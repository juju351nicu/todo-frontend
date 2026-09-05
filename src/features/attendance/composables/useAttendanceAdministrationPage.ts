import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import AttendanceApi, {
  AttendanceApiError,
} from "@/features/attendance/api/attendanceApi";
import type {
  AttendanceMonthListItem,
  AttendanceMonthResponse,
  AttendanceMonthStatus,
} from "@/features/attendance/types/attendance";
import {
  buildAttendanceMonthDateRange,
  getTodayInTokyo,
} from "@/features/attendance/utils/attendance";
import { useUserStore } from "@/features/auth/stores/user";

/** 管理一覧の状態絞込み選択肢。空文字は全状態を表す。 */
export const ATTENDANCE_MONTH_STATUS_OPTIONS = [
  { title: "すべて", value: "" },
  { title: "下書き", value: "DRAFT" },
  { title: "提出済み", value: "SUBMITTED" },
  { title: "承認済み", value: "APPROVED" },
  { title: "差戻し", value: "REJECTED" },
  { title: "締め済み", value: "CLOSED" },
] as const;

type AttendanceMonthAction = "approve" | "reject" | "close";

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
  const processingAction = ref<AttendanceMonthAction | null>(null);
  const months = ref<AttendanceMonthListItem[]>([]);
  const reviewComment = ref("");
  const rejectReason = ref("");
  const selectedAccountId = ref<number | null>(null);
  const selectedDetail = ref<AttendanceMonthResponse | null>(null);
  const selectedMonth = ref(getTodayInTokyo().slice(0, 7));
  const selectedStatus = ref<AttendanceMonthStatus | "">("");
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
      processingAction.value !== null
  );

  /** 初期表示月の永続化済み勤怠月を取得する。 */
  const initialize = async (): Promise<void> => {
    await loadMonths();
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
      errorMessages.value = ["差戻し理由を入力してください。"];
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
        selectedStatus.value || null
      );
      months.value = response.months;
    } catch (error: unknown) {
      await handleApiError(error, "勤怠月一覧を取得できませんでした。");
    } finally {
      isLoadingList.value = false;
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
      await handleApiError(error, "勤怠月詳細を取得できませんでした。");
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
      await handleApiError(error, "勤怠月の状態を更新できませんでした。");
      if (error instanceof AttendanceApiError && error.status === 409) {
        // version競合後は古い画面値で再実行させず、最新詳細と一覧へ戻す。
        const conflictMessages = [...errorMessages.value];
        await Promise.all([loadSelectedDetail(), loadMonths()]);
        errorMessages.value = conflictMessages;
      }
    } finally {
      processingAction.value = null;
    }
  };

  /** API失敗をSession状態と利用者向けメッセージへ変換する。 */
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
      errorMessages.value = ["勤怠月を参照または更新するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = ["対象のアカウントまたは勤怠月が見つかりません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value =
      fieldMessages.length > 0 ? fieldMessages : [fallbackMessage];
  };

  return {
    approve,
    canApproveOrReject,
    canCloseMonth,
    close,
    errorMessages,
    initialize,
    isLoading,
    months,
    processingAction,
    reject,
    rejectReason,
    reviewComment,
    search,
    selectMonth,
    selectedAccountId,
    selectedDetail,
    selectedListItem,
    selectedMonth,
    selectedStatus,
    statusOptions: ATTENDANCE_MONTH_STATUS_OPTIONS,
    successMessage,
  };
};
