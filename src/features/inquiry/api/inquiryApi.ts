import type {
  InquiryRequest,
  InquiryResponse,
} from "@/features/inquiry/types/inquiry";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";
import type { ErrorResponse } from "@/shared/types/error";
import { ensureApiSuccess } from "@/shared/utils/apiError";

/** 問い合わせAPIのHTTPエラーをstatusとBackendエラー本文付きで表す。 */
export class InquiryApiError extends Error {
  readonly status: number;

  readonly errorResponse: ErrorResponse | null;

  constructor(status: number, errorResponse: ErrorResponse | null) {
    super(`問い合わせAPIの実行に失敗しました。status=${status}`);
    this.name = "InquiryApiError";
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/**
 * 問い合わせ内容をBackendへ送信する。
 *
 * @param payload 氏名、返信先メールアドレス、問い合わせ本文
 * @returns 送信済みの問い合わせ内容。旧Backend互換のValidation結果を含み得る
 * @throws InquiryApiError 入力不正、CSRF拒否、送信基盤停止またはBackendエラーの場合
 */
const send = async (payload: InquiryRequest): Promise<InquiryResponse> => {
  const response = await HttpClient.postRequest(
    API_PATHS.INQUIRY_SEND_MAIL,
    payload
  );
  await ensureApiSuccess(
    response,
    (status, errorResponse) => new InquiryApiError(status, errorResponse)
  );
  return (await response.json()) as InquiryResponse;
};

export default {
  send,
};
