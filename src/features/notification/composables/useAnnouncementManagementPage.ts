import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import NotificationApi, {
  NotificationApiError,
} from "@/features/notification/api/notificationApi";
import { NOTIFICATION_REFRESH_EVENT } from "@/features/notification/composables/useNotificationCenter";

/** 管理者お知らせ入力の最大文字数。Backend Bean Validationと同じ上限に保つ。 */
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 100;

/** 管理者お知らせ本文の最大文字数。Backend Bean Validationと同じ上限に保つ。 */
export const ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 2000;

/** 全利用者向けお知らせ画面の入力、送信状態、認証・入力エラー処理を提供する。 */
export const useAnnouncementManagementPage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const errorMessages = ref<string[]>([]);
  const expiresAtLocal = ref("");
  const isSubmitting = ref(false);
  const message = ref("");
  const successMessage = ref("");
  const title = ref("");

  const canSubmit = computed(
    () =>
      !isSubmitting.value &&
      title.value.trim().length > 0 &&
      title.value.trim().length <= ANNOUNCEMENT_TITLE_MAX_LENGTH &&
      message.value.trim().length > 0 &&
      message.value.trim().length <= ANNOUNCEMENT_MESSAGE_MAX_LENGTH
  );

  /** 入力値をBackend契約へ変換してお知らせを発行し、同じ画面のベルも再取得させる。 */
  const submitAnnouncement = async (): Promise<void> => {
    if (!canSubmit.value) {
      errorMessages.value = ["件名と本文を入力上限内で入力してください。"];
      return;
    }
    isSubmitting.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const expiresAt = buildExpiresAt();
      await NotificationApi.createAnnouncement({
        title: title.value.trim(),
        message: message.value.trim(),
        expiresAt,
      });
      title.value = "";
      message.value = "";
      expiresAtLocal.value = "";
      successMessage.value = "お知らせを全利用者へ配信しました。";
      window.dispatchEvent(new Event(NOTIFICATION_REFRESH_EVENT));
    } catch (error: unknown) {
      await handleApiError(error);
    } finally {
      isSubmitting.value = false;
    }
  };

  /** datetime-local値をUTC Instant文字列へ変換する。未入力は無期限のnullを返す。 */
  const buildExpiresAt = (): string | null => {
    if (!expiresAtLocal.value) {
      return null;
    }
    const value = new Date(expiresAtLocal.value);
    if (Number.isNaN(value.getTime())) {
      throw new Error("invalid announcement expiration");
    }
    return value.toISOString();
  };

  /** 通知APIの失敗をSession遷移または利用者向けメッセージへ変換する。 */
  const handleApiError = async (error: unknown): Promise<void> => {
    if (!(error instanceof NotificationApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["お知らせを配信するpermissionがありません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value =
      fieldMessages.length > 0
        ? fieldMessages
        : ["お知らせを配信できませんでした。入力内容を確認してください。"];
  };

  return {
    canSubmit,
    errorMessages,
    expiresAtLocal,
    isSubmitting,
    message,
    submitAnnouncement,
    successMessage,
    title,
  };
};
