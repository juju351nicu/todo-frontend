import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import NotificationApi, {
  NotificationApiError,
} from "@/features/notification/api/notificationApi";
import { NOTIFICATION_REFRESH_EVENT } from "@/features/notification/composables/useNotificationCenter";
import { ANNOUNCEMENT_ERROR_CODES } from "@/features/notification/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";

/** 管理者お知らせ入力の最大文字数。Backend Bean Validationと同じ上限に保つ。 */
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 100;

/** 管理者お知らせ本文の最大文字数。Backend Bean Validationと同じ上限に保つ。 */
export const ANNOUNCEMENT_MESSAGE_MAX_LENGTH = 2000;

/** 全利用者向けお知らせ画面の入力、送信状態、認証・入力エラー処理を提供する。 */
export const useAnnouncementManagementPage = () => {
  const router = useRouter();
  const { expireSession } = useSessionExpiry();

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
    successMessage.value = "";
    if (!canSubmit.value) {
      errorMessages.value = [
        DISPLAY_MESSAGES.notification.announcement.invalidInput,
      ];
      return;
    }
    let expiresAt: string | null;
    try {
      expiresAt = buildExpiresAt();
    } catch (_error: unknown) {
      errorMessages.value = [
        DISPLAY_MESSAGES.notification.announcement.invalidExpiration,
      ];
      return;
    }
    isSubmitting.value = true;
    errorMessages.value = [];
    try {
      await NotificationApi.createAnnouncement({
        title: title.value.trim(),
        message: message.value.trim(),
        expiresAt,
      });
      title.value = "";
      message.value = "";
      expiresAtLocal.value = "";
      successMessage.value =
        DISPLAY_MESSAGES.notification.announcement.published;
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
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (error.status === 401) {
      await expireSession();
      return;
    }
    if (error.status === 403) {
      errorMessages.value = [
        DISPLAY_MESSAGES.notification.announcement.operationForbidden,
      ];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      ANNOUNCEMENT_ERROR_CODES,
      DISPLAY_MESSAGES.notification.announcement.publishFailed
    );
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
