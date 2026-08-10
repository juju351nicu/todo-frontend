import Const from "@/constants/const";
import type { InquiryRequest } from "@/features/inquiry/types/inquiry";
import HttpClient from "@/shared/api/httpClient";

/** 問い合わせ内容をBackendへ送信する。 */
const send = (payload: InquiryRequest): Promise<Response> =>
  HttpClient.postRequest(Const.REST_PATH.INQUIRY_SEND_MAIL, payload);

export default {
  send,
};
