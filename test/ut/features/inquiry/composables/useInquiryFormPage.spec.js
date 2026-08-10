import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInquiryFormPage } from "@/features/inquiry/composables/useInquiryFormPage";

const mocks = vi.hoisted(() => ({
  inquiryApi: {
    send: vi.fn(),
  },
}));

vi.mock("@/features/inquiry/api/inquiryApi", () => ({
  default: mocks.inquiryApi,
}));

describe("useInquiryFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("問い合わせを送信し、成功メッセージと空のフォームを表示する", async () => {
    mocks.inquiryApi.send.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ validationErrorMessages: null }),
    });
    const page = useInquiryFormPage();
    page.fullName.value = "山田 太郎";
    page.email.value = "yamada@example.com";
    page.message.value = "お問い合わせ内容";

    await page.submit();

    expect(mocks.inquiryApi.send).toHaveBeenCalledWith({
      fullName: "山田 太郎",
      email: "yamada@example.com",
      message: "お問い合わせ内容",
    });
    expect(page.successMessage.value).toBe("お問い合わせを送信しました。");
    expect(page.fullName.value).toBe("");
    expect(page.email.value).toBe("");
    expect(page.message.value).toBe("");
    expect(page.isLoading.value).toBe(false);
  });

  it("Backendの入力エラーを画面メッセージへ変換する", async () => {
    mocks.inquiryApi.send.mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        fieldErrors: [{ field: "email", message: "不正なメールアドレスです。" }],
      }),
    });
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual(["不正なメールアドレスです。"]);
    expect(page.successMessage.value).toBe("");
  });

  it("旧レスポンスの検証メッセージも画面へ表示する", async () => {
    mocks.inquiryApi.send.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        validationErrorMessages: ["お問い合わせ内容が未入力です。"],
      }),
    });
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual([
      "お問い合わせ内容が未入力です。",
    ]);
  });

  it("Backend接続失敗を画面メッセージへ変換する", async () => {
    mocks.inquiryApi.send.mockRejectedValue(new Error("offline"));
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
    expect(page.isLoading.value).toBe(false);
  });
});
