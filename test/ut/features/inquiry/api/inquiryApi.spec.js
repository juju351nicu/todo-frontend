import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import InquiryApi from "@/features/inquiry/api/inquiryApi";
import HttpClient from "@/shared/api/httpClient";

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
    const response = { ok: true };
    HttpClient.postRequest.mockResolvedValue(response);

    await expect(InquiryApi.send(payload)).resolves.toBe(response);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      Const.REST_PATH.INQUIRY_SEND_MAIL,
      payload
    );
  });
});
