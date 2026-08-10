import type { InquiryRequest } from "@/features/inquiry/types/inquiry";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

/** 問い合わせ内容をBackendへ送信する。 */
const send = (payload: InquiryRequest): Promise<Response> =>
  HttpClient.postRequest(API_PATHS.INQUIRY_SEND_MAIL, payload);

export default {
  send,
};
