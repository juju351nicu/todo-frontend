import { ref } from "vue";

import InquiryApi, { InquiryApiError } from "@/features/inquiry/api/inquiryApi";
import type { InquiryRequest } from "@/features/inquiry/types/inquiry";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";

const INQUIRY_ERROR_CODES: ReadonlySet<string> = new Set([
  "INVALID_REQUEST_BODY",
  "INQUIRY_DELIVERY_FAILED",
]);

/** 問い合わせ画面の状態と操作を提供する。 */
export const useInquiryFormPage = () => {
  const email = ref("");
  const errorMessages = ref<string[]>([]);
  const fullName = ref("");
  const isLoading = ref(false);
  const message = ref("");
  const successMessage = ref("");

  /** 入力中の画面状態を、Backendへ送信するRequestのスナップショットへ変換する。 */
  const buildInquiryRequest = (): InquiryRequest => ({
    fullName: fullName.value,
    email: email.value,
    message: message.value,
  });

  /** 送信成功後だけ問い合わせ入力を空に戻す。 */
  const clearForm = (): void => {
    fullName.value = "";
    email.value = "";
    message.value = "";
  };

  /** 入力された問い合わせ内容をBackendへ送信する。 */
  const submit = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    isLoading.value = true;
    try {
      const data = await InquiryApi.send(buildInquiryRequest());
      if (data.validationErrorMessages?.length) {
        // 旧Responseの自由文は表示せず、Bean Validation APIと同じ固定案内へ閉じる。
        errorMessages.value = [DISPLAY_MESSAGES.inquiry.invalidInput];
        return;
      }

      successMessage.value = DISPLAY_MESSAGES.inquiry.sent;
      clearForm();
    } catch (error: unknown) {
      if (error instanceof InquiryApiError) {
        errorMessages.value = resolveApiErrorMessages(
          error.errorResponse,
          INQUIRY_ERROR_CODES,
          error.status === 400
            ? DISPLAY_MESSAGES.inquiry.invalidInput
            : DISPLAY_MESSAGES.inquiry.sendFailed
        );
      } else {
        errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      }
    } finally {
      isLoading.value = false;
    }
  };

  return {
    email,
    errorMessages,
    fullName,
    isLoading,
    message,
    submit,
    successMessage,
  };
};
