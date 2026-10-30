import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingApiError } from "@/features/billing/api/billingApi";
import { useBillingPage } from "@/features/billing/composables/useBillingPage";

const mocks = vi.hoisted(() => ({
  billingApi: {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    getMyBilling: vi.fn(),
  },
  expireSession: vi.fn(),
  redirectToStripeHostedPage: vi.fn(),
  route: { query: {} },
}));

vi.mock("vue-router", () => ({ useRoute: () => mocks.route }));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

vi.mock("@/features/billing/api/billingApi", async () => {
  const actual = await vi.importActual("@/features/billing/api/billingApi");
  return { ...actual, default: mocks.billingApi };
});

vi.mock("@/features/billing/utils/stripeNavigation", () => ({
  redirectToStripeHostedPage: mocks.redirectToStripeHostedPage,
}));

const freeBilling = {
  planCode: "FREE",
  subscriptionStatus: null,
  currentPeriodEndAt: null,
  cancelAtPeriodEnd: false,
  featureCodes: [],
};

const proBilling = {
  planCode: "PRO",
  subscriptionStatus: "active",
  currentPeriodEndAt: "2026-11-30T00:00:00Z",
  cancelAtPeriodEnd: false,
  featureCodes: ["DASHBOARD_ADVANCED", "TASK_RECURRENCE", "TEMPLATE_MANAGEMENT"],
};

describe("useBillingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.route.query = {};
    mocks.billingApi.getMyBilling.mockResolvedValue(freeBilling);
    mocks.billingApi.createCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.com/c/pay/session",
      expiresAt: "2026-10-30T12:00:00Z",
    });
    mocks.billingApi.createPortalSession.mockResolvedValue({
      portalUrl: "https://billing.stripe.com/p/session/test",
    });
    mocks.redirectToStripeHostedPage.mockReturnValue(true);
    mocks.expireSession.mockResolvedValue(undefined);
  });

  it("初期表示で本人課金状態を取得し、契約履歴なしではCheckoutだけを許可する", async () => {
    const page = useBillingPage();

    await page.initialize();

    expect(mocks.billingApi.getMyBilling).toHaveBeenCalledOnce();
    expect(page.billing.value).toEqual(freeBilling);
    expect(page.canStartCheckout.value).toBe(true);
    expect(page.canOpenPortal.value).toBe(false);
  });

  it("Pro契約ではCheckoutを止めてCustomer Portalを許可する", async () => {
    mocks.billingApi.getMyBilling.mockResolvedValue(proBilling);
    const page = useBillingPage();

    await page.initialize();

    expect(page.isPro.value).toBe(true);
    expect(page.canStartCheckout.value).toBe(false);
    expect(page.canOpenPortal.value).toBe(true);
  });

  it("Checkout成功return後もprojectionがFreeなら定期pollingせず反映待ちを案内する", async () => {
    mocks.route.query = { checkout: "success" };
    const page = useBillingPage();

    await page.initialize();

    expect(page.informationMessage.value).toContain("決済結果を確認しています");
    expect(mocks.billingApi.getMyBilling).toHaveBeenCalledOnce();
  });

  it("Checkout成功return後にProなら反映完了を案内する", async () => {
    mocks.route.query = { checkout: "success" };
    mocks.billingApi.getMyBilling.mockResolvedValue(proBilling);
    const page = useBillingPage();

    await page.initialize();

    expect(page.informationMessage.value).toContain("Pro契約が反映されました");
  });

  it("Checkout取消returnでは契約状態が変わらないことを案内する", async () => {
    mocks.route.query = { checkout: "cancel" };
    const page = useBillingPage();

    await page.initialize();

    expect(page.informationMessage.value).toContain("Checkoutをキャンセルしました");
  });

  it("Pro月額Checkoutを一度だけ作成し短命URLを保存せず外部遷移へ渡す", async () => {
    let resolveCheckout;
    mocks.billingApi.createCheckoutSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckout = resolve;
        })
    );
    const page = useBillingPage();
    await page.initialize();

    const firstRequest = page.startCheckout();
    const secondRequest = page.startCheckout();

    expect(mocks.billingApi.createCheckoutSession).toHaveBeenCalledOnce();
    expect(mocks.billingApi.createCheckoutSession).toHaveBeenCalledWith({
      planCode: "PRO",
      billingInterval: "MONTHLY",
    });
    resolveCheckout({
      checkoutUrl: "https://checkout.stripe.com/c/pay/session",
      expiresAt: "2026-10-30T12:00:00Z",
    });
    await Promise.all([firstRequest, secondRequest]);
    expect(mocks.redirectToStripeHostedPage).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay/session",
      "checkout"
    );
  });

  it("Checkout URLが許可条件外なら外部遷移せず安全な固定文言を表示する", async () => {
    mocks.redirectToStripeHostedPage.mockReturnValue(false);
    const page = useBillingPage();
    await page.initialize();

    await page.startCheckout();

    expect(page.errorMessages.value).toEqual([
      "安全なStripe画面を開けませんでした。再度お試しください。",
    ]);
  });

  it("契約履歴がある本人のCustomer Portalを開く", async () => {
    mocks.billingApi.getMyBilling.mockResolvedValue(proBilling);
    const page = useBillingPage();
    await page.initialize();

    await page.openCustomerPortal();

    expect(mocks.billingApi.createPortalSession).toHaveBeenCalledOnce();
    expect(mocks.redirectToStripeHostedPage).toHaveBeenCalledWith(
      "https://billing.stripe.com/p/session/test",
      "portal"
    );
  });

  it("401は契約snapshotを破棄してSession失効処理へ渡す", async () => {
    mocks.billingApi.getMyBilling.mockRejectedValue(new BillingApiError(401, null));
    const page = useBillingPage();

    await page.initialize();

    expect(page.billing.value).toBeNull();
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.expireSession).toHaveBeenCalledOnce();
  });

  it("契約済み409 codeのBackend文言だけを表示する", async () => {
    mocks.billingApi.createCheckoutSession.mockRejectedValue(
      new BillingApiError(409, {
        fieldErrors: [
          {
            errorCode: "BILLING_SUBSCRIPTION_ALREADY_ACTIVE",
            field: "subscription",
            message: "有効な契約がすでにあります。",
          },
        ],
      })
    );
    const page = useBillingPage();
    await page.initialize();

    await page.startCheckout();

    expect(page.errorMessages.value).toEqual(["有効な契約がすでにあります。"]);
  });

  it("未知codeのBackend本文は表示せずCheckout用fallbackへ閉じる", async () => {
    mocks.billingApi.createCheckoutSession.mockRejectedValue(
      new BillingApiError(409, {
        fieldErrors: [
          { errorCode: "UNKNOWN_BILLING_ERROR", field: "billing", message: "内部情報です。" },
        ],
      })
    );
    const page = useBillingPage();
    await page.initialize();

    await page.startCheckout();

    expect(page.errorMessages.value).toEqual(["Checkoutを開始できませんでした。"]);
  });
});
