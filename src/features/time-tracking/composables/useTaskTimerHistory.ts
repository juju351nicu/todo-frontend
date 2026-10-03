import { ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TimeTrackingApi, {
  TimeTrackingApiError,
} from "@/features/time-tracking/api/timeTrackingApi";
import type { TaskTimerSessionListResponse } from "@/features/time-tracking/types/timeTracking";
import { buildDefaultTimerHistoryRange } from "@/features/time-tracking/utils/timeTracking";

const PAGE_SIZE = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Timer履歴の入力期間をBackendと同じ最大366日で検証する。 */
const validateDateRange = (dateFrom: string, dateTo: string): string[] => {
  if (!DATE_PATTERN.test(dateFrom) || !DATE_PATTERN.test(dateTo)) {
    return ["開始日と終了日を入力してください。"];
  }
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to.getTime()) ||
    from.toISOString().slice(0, 10) !== dateFrom ||
    to.toISOString().slice(0, 10) !== dateTo
  ) {
    return ["実在する開始日と終了日を入力してください。"];
  }
  const inclusiveDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (inclusiveDays < 1) {
    return ["開始日は終了日以前にしてください。"];
  }
  return inclusiveDays > 366 ? ["検索期間は366日以内にしてください。"] : [];
};

/** 本人Timer Session履歴Dialogの期間、paging、認証エラーを管理する。 */
export const useTaskTimerHistory = () => {
  const router = useRouter();
  const userStore = useUserStore();
  const defaultRange = buildDefaultTimerHistoryRange();
  const dateFrom = ref(defaultRange.dateFrom);
  const dateTo = ref(defaultRange.dateTo);
  const errorMessages = ref<string[]>([]);
  const history = ref<TaskTimerSessionListResponse | null>(null);
  const isLoading = ref(false);
  const isOpen = ref(false);

  /** 現在の入力期間と指定pageで本人Timer履歴を取得する。 */
  const loadHistory = async (page = 0): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    const validationMessages = validateDateRange(dateFrom.value, dateTo.value);
    if (validationMessages.length > 0) {
      errorMessages.value = validationMessages;
      return;
    }

    isLoading.value = true;
    errorMessages.value = [];
    try {
      history.value = await TimeTrackingApi.getSessions({
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
        page,
        size: PAGE_SIZE,
      });
    } catch (error: unknown) {
      if (error instanceof TimeTrackingApiError) {
        if (error.status === 401) {
          userStore.clearSession();
          closeDialogAfterSessionExpiry();
          await router.push({ name: "Login" });
          return;
        }
        const fieldMessages = (error.errorResponse?.fieldErrors ?? [])
          .map((fieldError) => fieldError.message?.trim())
          .filter((message): message is string => Boolean(message));
        errorMessages.value =
          fieldMessages.length > 0
            ? fieldMessages
            : ["Timer履歴を取得できませんでした。"];
      } else {
        errorMessages.value = ["Backendへ接続できませんでした。"];
      }
    } finally {
      isLoading.value = false;
    }
  };

  /** Dialogを開き、入力期間の先頭ページを取得する。 */
  const openDialog = async (): Promise<void> => {
    isOpen.value = true;
    await loadHistory(0);
  };

  /** 読込中でない場合にDialogと一時エラーを閉じる。 */
  const closeDialog = (): void => {
    if (!isLoading.value) {
      isOpen.value = false;
      errorMessages.value = [];
    }
  };

  /** Session失効時に処理中状態へ依存せずDialogを閉じる。 */
  const closeDialogAfterSessionExpiry = (): void => {
    isOpen.value = false;
    errorMessages.value = [];
  };

  /** 現在pageより前が存在する場合だけ前ページを取得する。 */
  const loadPreviousPage = async (): Promise<void> => {
    if (history.value !== null && history.value.page > 0) {
      await loadHistory(history.value.page - 1);
    }
  };

  /** 現在pageより後が存在する場合だけ次ページを取得する。 */
  const loadNextPage = async (): Promise<void> => {
    if (
      history.value !== null &&
      history.value.page + 1 < history.value.totalPages
    ) {
      await loadHistory(history.value.page + 1);
    }
  };

  return {
    closeDialog,
    dateFrom,
    dateTo,
    errorMessages,
    history,
    isLoading,
    isOpen,
    loadHistory,
    loadNextPage,
    loadPreviousPage,
    openDialog,
  };
};
