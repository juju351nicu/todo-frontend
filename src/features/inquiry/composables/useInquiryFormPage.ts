import { ref } from "vue";

import InquiryApi from "@/features/inquiry/api/inquiryApi";
import type {
  InquiryRequest,
  InquiryResponse,
} from "@/features/inquiry/types/inquiry";
import type { ErrorResponse } from "@/shared/types/error";

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

  /** Backendの項目エラーを画面メッセージへ変換し、項目がない失敗にも既定文言を設定する。 */
  const setResponseErrors = (errorResponse: ErrorResponse): void => {
    errorMessages.value = (errorResponse.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    if (errorMessages.value.length === 0) {
      errorMessages.value = ["お問い合わせを送信できませんでした。"];
    }
  };

  /** 送信成功後だけ問い合わせ入力を空に戻す。 */
  const clearForm = (): void => {
    fullName.value = "";
    email.value = "";
    message.value = "";
  };

  /** 入力された問い合わせ内容をBackendへ送信する。 */
  const submit = async (): Promise<void> => {
    errorMessages.value = [];
    successMessage.value = "";
    isLoading.value = true;
    try {
      const response = await InquiryApi.send(buildInquiryRequest());
      if (!response.ok) {
        setResponseErrors((await response.json()) as ErrorResponse);
        return;
      }

      const data = (await response.json()) as InquiryResponse;
      if (data.validationErrorMessages?.length) {
        errorMessages.value = data.validationErrorMessages;
        return;
      }

      successMessage.value = "お問い合わせを送信しました。";
      clearForm();
    } catch (_error: unknown) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
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
