/** 問い合わせ送信APIリクエスト。 */
export interface InquiryRequest {
  fullName: string;
  email: string;
  message: string;
}

/** 問い合わせ送信APIレスポンス。 */
export interface InquiryResponse extends InquiryRequest {
  validationErrorMessages: string[] | null;
}
