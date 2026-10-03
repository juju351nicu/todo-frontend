import { ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import TimeTrackingApi, {
  TimeTrackingApiError,
} from "@/features/time-tracking/api/timeTrackingApi";
import type { TaskWorkLogAuditListResponse } from "@/features/time-tracking/types/timeTracking";

const PAGE_SIZE = 20;

/** 指定Taskの工数監査Dialogについて、読込、paging、認証・認可エラーを管理する。 */
export const useTaskWorkLogAudits = (projectId: number, taskId: number) => {
  const router = useRouter();
  const userStore = useUserStore();
  const audits = ref<TaskWorkLogAuditListResponse | null>(null);
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const isOpen = ref(false);

  /** 指定pageの手入力・Timer加算監査をBackendから取得する。 */
  const loadAudits = async (page = 0): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      audits.value = await TimeTrackingApi.getWorkLogAudits(
        projectId,
        taskId,
        page,
        PAGE_SIZE
      );
    } catch (error: unknown) {
      if (!(error instanceof TimeTrackingApiError)) {
        errorMessages.value = ["Backendへ接続できませんでした。"];
        return;
      }
      if (error.status === 401) {
        userStore.clearSession();
        closeDialogAfterSessionExpiry();
        await router.push({ name: "Login" });
        return;
      }
      if (error.status === 403) {
        errorMessages.value = ["Task実績工数の変更履歴を参照する権限がありません。"];
        return;
      }
      if (error.status === 404) {
        errorMessages.value = ["対象のProjectまたはTaskが見つかりません。"];
        return;
      }
      const fieldMessages = (error.errorResponse?.fieldErrors ?? [])
        .map((fieldError) => fieldError.message?.trim())
        .filter((message): message is string => Boolean(message));
      errorMessages.value =
        fieldMessages.length > 0
          ? fieldMessages
          : ["Task実績工数の変更履歴を取得できませんでした。"];
    } finally {
      isLoading.value = false;
    }
  };

  /** Dialogを開き、監査の先頭ページを取得する。 */
  const openDialog = async (): Promise<void> => {
    isOpen.value = true;
    await loadAudits(0);
  };

  /** 読込中でなければDialogを閉じる。 */
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
    if (audits.value !== null && audits.value.page > 0) {
      await loadAudits(audits.value.page - 1);
    }
  };

  /** 現在pageより後が存在する場合だけ次ページを取得する。 */
  const loadNextPage = async (): Promise<void> => {
    if (
      audits.value !== null &&
      audits.value.page + 1 < audits.value.totalPages
    ) {
      await loadAudits(audits.value.page + 1);
    }
  };

  return {
    audits,
    closeDialog,
    errorMessages,
    isLoading,
    isOpen,
    loadAudits,
    loadNextPage,
    loadPreviousPage,
    openDialog,
  };
};
