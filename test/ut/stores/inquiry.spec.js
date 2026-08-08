import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import { useInquiryStore } from "@/stores/inquiry";
import Fetcher from "@/utils/rest";

vi.mock("@/utils/rest", () => ({
  default: {
    postRequest: vi.fn(),
  },
}));

describe("Inquiry store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("問い合わせAPIへ入力情報を送信してレスポンスを返す", async () => {
    const payload = {
      fullName: "山田 太郎",
      email: "yamada@example.com",
      message: "お問い合わせ内容",
    };
    const inquiryResponse = {
      ...payload,
      validationErrorMessages: null,
    };
    Fetcher.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(inquiryResponse),
    });
    const store = useInquiryStore();

    const request = store.recieveInquiryInfo(payload);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(inquiryResponse);
    expect(Fetcher.postRequest).toHaveBeenCalledWith(
      Const.REST_PATH.INQUIRY_SEND_MAIL,
      payload
    );
    expect(store.isLoading).toBe(false);
  });

  it("問い合わせAPIが失敗しても処理中フラグを解除する", async () => {
    Fetcher.postRequest.mockResolvedValue({ ok: false, status: 400 });
    const store = useInquiryStore();

    await expect(
      store.recieveInquiryInfo({
        fullName: "",
        email: "",
        message: "",
      })
    ).resolves.toBeNull();

    expect(store.isLoading).toBe(false);
  });
});
