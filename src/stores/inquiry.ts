import { defineStore } from "pinia";

import Const from "@/constants/const";
import type { InquiryRequest, InquiryResponse } from "@/types/inquiry";
import Fetcher from "@/utils/rest";

interface InquiryState {
  isLoading: boolean;
}

export const useInquiryStore = defineStore("inquiry", {
  state: (): InquiryState => ({
    isLoading: false,
  }),
  actions: {
    /** 問い合わせ情報を送信する。 */
    async recieveInquiryInfo(
      payload: InquiryRequest
    ): Promise<InquiryResponse | null> {
      this.isLoading = true;
      try {
        const response = await Fetcher.postRequest(
          Const.REST_PATH.INQUIRY_SEND_MAIL,
          payload
        );
        if (!response.ok) {
          throw new Error(
            `問い合わせの送信に失敗しました。status=${response.status}`
          );
        }
        return (await response.json()) as InquiryResponse;
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
