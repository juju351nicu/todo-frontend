import { beforeEach, describe, expect, it, vi } from "vitest";

import InquiryApi, { InquiryApiError } from "@/features/inquiry/api/inquiryApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    postRequest: vi.fn(),
  },
}));

describe("Inquiry API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("問い合わせ送信APIへ入力情報を渡す", async () => {
    const payload = {
      fullName: "山田 太郎",
      email: "yamada@example.com",
      message: "お問い合わせ内容",
    };
    const inquiryResponse = { ...payload, validationErrorMessages: null };
    const response = {
      ok: true,
      json: vi.fn().mockResolvedValue(inquiryResponse),
    };
    HttpClient.postRequest.mockResolvedValue(response);

    await expect(InquiryApi.send(payload)).resolves.toEqual(inquiryResponse);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(API_PATHS.INQUIRY_SEND_MAIL, payload);
  });

  it("送信基盤停止のJSON Responseをstatus付き例外へ変換する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "INQUIRY_DELIVERY_FAILED",
          field: "inquiry",
          message: "お問い合わせを送信できませんでした。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      InquiryApi.send({
        fullName: "山田",
        email: "a@example.com",
        message: "本文",
      })
    ).rejects.toEqual(new InquiryApiError(503, errorResponse));
  });

  it("JSONではない拒否Responseは本文をnullへ閉じる", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockRejectedValue(new SyntaxError("not json")),
    });

    await expect(
      InquiryApi.send({
        fullName: "山田",
        email: "a@example.com",
        message: "本文",
      })
    ).rejects.toMatchObject({
      name: "InquiryApiError",
      status: 403,
      errorResponse: null,
    });
  });
});
