import { beforeEach, describe, expect, it, vi } from "vitest";

import { InquiryApiError } from "@/features/inquiry/api/inquiryApi";
import { useInquiryFormPage } from "@/features/inquiry/composables/useInquiryFormPage";

const mocks = vi.hoisted(() => ({
  inquiryApi: {
    send: vi.fn(),
  },
}));

vi.mock("@/features/inquiry/api/inquiryApi", async () => {
  const actual = await vi.importActual("@/features/inquiry/api/inquiryApi");
  return { ...actual, default: mocks.inquiryApi };
});

describe("useInquiryFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("問い合わせを送信し、成功メッセージと空のフォームを表示する", async () => {
    mocks.inquiryApi.send.mockResolvedValue({ validationErrorMessages: null });
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
    mocks.inquiryApi.send.mockRejectedValue(
      new InquiryApiError(400, {
        fieldErrors: [
          {
            errorCode: "INVALID_REQUEST_BODY",
            field: "email",
            message: "不正なメールアドレスです。",
          },
        ],
      })
    );
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual(["不正なメールアドレスです。"]);
    expect(page.successMessage.value).toBe("");
  });

  it("旧レスポンスの自由文検証メッセージは固定案内へ閉じる", async () => {
    mocks.inquiryApi.send.mockResolvedValue({
      validationErrorMessages: ["内部入力値を含む可能性がある文言"],
    });
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual(["お問い合わせ内容を確認してください。"]);
  });

  it("送信基盤停止は契約済みの安全なBackend文言を表示する", async () => {
    mocks.inquiryApi.send.mockRejectedValue(
      new InquiryApiError(503, {
        fieldErrors: [
          {
            errorCode: "INQUIRY_DELIVERY_FAILED",
            field: "inquiry",
            message: "お問い合わせを送信できませんでした。時間を置いて再度お試しください。",
          },
        ],
      })
    );
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual([
      "お問い合わせを送信できませんでした。時間を置いて再度お試しください。",
    ]);
  });

  it("未知codeのBackend本文は送信失敗の固定案内へ閉じる", async () => {
    mocks.inquiryApi.send.mockRejectedValue(
      new InquiryApiError(500, {
        fieldErrors: [
          {
            errorCode: "SMTP_INTERNAL_DETAIL",
            field: "inquiry",
            message: "smtp.internal.example:2525",
          },
        ],
      })
    );
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual([
      "お問い合わせを送信できませんでした。時間を置いて再度お試しください。",
    ]);
  });

  it("Backend接続失敗を画面メッセージへ変換する", async () => {
    mocks.inquiryApi.send.mockRejectedValue(new Error("offline"));
    const page = useInquiryFormPage();

    await page.submit();

    expect(page.errorMessages.value).toEqual(["Backendへ接続できませんでした。"]);
    expect(page.isLoading.value).toBe(false);
  });

  it("送信処理中の二重送信を行わない", async () => {
    let resolveInquiry;
    mocks.inquiryApi.send.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInquiry = resolve;
        })
    );
    const page = useInquiryFormPage();

    const firstSubmission = page.submit();
    const secondSubmission = page.submit();

    expect(mocks.inquiryApi.send).toHaveBeenCalledOnce();
    resolveInquiry({ validationErrorMessages: null });
    await Promise.all([firstSubmission, secondSubmission]);
  });
});
