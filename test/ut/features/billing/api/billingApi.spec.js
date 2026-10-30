import { beforeEach, describe, expect, it, vi } from "vitest";

import BillingApi, { BillingApiError } from "@/features/billing/api/billingApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

describe("Billing API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("本人の課金状態を取得し、機能一覧欠落を空配列へ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        planCode: "FREE",
        subscriptionStatus: null,
        currentPeriodEndAt: null,
        cancelAtPeriodEnd: false,
      }),
    });

    await expect(BillingApi.getMyBilling()).resolves.toMatchObject({
      planCode: "FREE",
      featureCodes: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.BILLING_ME);
  });

  it("Pro月額だけをCheckout Session作成APIへ渡す", async () => {
    const payload = {
      checkoutUrl: "https://checkout.stripe.com/c/pay/session",
      expiresAt: "2026-10-30T12:00:00Z",
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(
      BillingApi.createCheckoutSession({ planCode: "PRO", billingInterval: "MONTHLY" })
    ).resolves.toEqual(payload);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(API_PATHS.BILLING_CHECKOUT_SESSIONS, {
      planCode: "PRO",
      billingInterval: "MONTHLY",
    });
  });

  it("bodyなしPOSTで本人Customer Portal Sessionを作成する", async () => {
    const payload = { portalUrl: "https://billing.stripe.com/p/session/test" };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(BillingApi.createPortalSession()).resolves.toEqual(payload);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(API_PATHS.BILLING_PORTAL_SESSIONS, null);
  });

  it("0始まりページ番号と表示件数を課金管理一覧APIへ渡す", async () => {
    const payload = {
      accounts: [],
      page: 1,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(BillingApi.getAdministrationAccounts(1, 20)).resolves.toEqual(payload);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/administration/billing/accounts?page=1&size=20"
    );
  });

  it("課金管理一覧のaccounts欠落を空配列へ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
      }),
    });

    await expect(BillingApi.getAdministrationAccounts(0, 50)).resolves.toMatchObject({
      accounts: [],
    });
  });

  it("対象Account IDを手動再照合APIへ渡し204を本文なし成功として扱う", async () => {
    HttpClient.postRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(BillingApi.reconcileAdministrationAccount(12)).resolves.toBeUndefined();
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/administration/billing/accounts/12/reconcile",
      null
    );
  });

  it("Backendの503項目エラーをstatus付き課金例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "BILLING_PROVIDER_UNAVAILABLE",
          field: "billingProvider",
          message: "課金サービスを利用できません。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    const promise = BillingApi.createPortalSession();

    await expect(promise).rejects.toMatchObject({ status: 503, errorResponse });
    await promise.catch((error) => expect(error).toBeInstanceOf(BillingApiError));
  });

  it("本文なし403もstatus付き課金例外へ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(BillingApi.getMyBilling()).rejects.toMatchObject({
      status: 403,
      errorResponse: null,
    });
  });
});
