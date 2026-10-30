import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingApiError } from "@/features/billing/api/billingApi";
import { useBillingAdministrationPage } from "@/features/billing/composables/useBillingAdministrationPage";

const mocks = vi.hoisted(() => ({
  billingApi: {
    getAdministrationAccounts: vi.fn(),
    reconcileAdministrationAccount: vi.fn(),
  },
  expireSession: vi.fn(),
  userStore: { hasPermission: vi.fn() },
}));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/billing/api/billingApi", async () => {
  const actual = await vi.importActual("@/features/billing/api/billingApi");
  return { ...actual, default: mocks.billingApi };
});

const account = {
  accountId: 12,
  displayName: "課金 利用者",
  accountStatus: "ACTIVE",
  billingCustomerConfigured: true,
  planCode: "PRO",
  subscriptionStatus: "active",
  subscriptionAccessible: true,
  currentPeriodEndAt: "2026-11-30T00:00:00Z",
  paidThroughAt: "2026-11-30T00:00:00Z",
  graceUntilAt: null,
  cancelAtPeriodEnd: false,
  featureCodes: ["TASK_RECURRENCE"],
  lastSyncedAt: "2026-10-30T00:00:00Z",
  lastReconciledAt: "2026-10-30T00:00:00Z",
  nextReconcileAt: "2026-10-30T06:00:00Z",
  reconciliationInProgress: false,
  lastReconcileErrorCode: null,
};

const response = {
  accounts: [account],
  page: 0,
  size: 50,
  totalElements: 51,
  totalPages: 2,
};

describe("useBillingAdministrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "BILLING_RECONCILE"
    );
    mocks.billingApi.getAdministrationAccounts.mockResolvedValue(response);
    mocks.billingApi.reconcileAdministrationAccount.mockResolvedValue(undefined);
    mocks.expireSession.mockResolvedValue(undefined);
  });

  it("初期表示でBackendの先頭ページを取得する", async () => {
    const page = useBillingAdministrationPage();

    await page.initialize();

    expect(mocks.billingApi.getAdministrationAccounts).toHaveBeenCalledWith(0, 50);
    expect(page.accounts.value).toEqual([account]);
    expect(page.totalElements.value).toBe(51);
    expect(page.totalPages.value).toBe(2);
  });

  it("画面の1始まりページ番号をBackendの0始まりへ変換する", async () => {
    mocks.billingApi.getAdministrationAccounts.mockResolvedValue({ ...response, page: 1 });
    const page = useBillingAdministrationPage();

    await page.changePage(2);

    expect(mocks.billingApi.getAdministrationAccounts).toHaveBeenCalledWith(1, 50);
    expect(page.page.value).toBe(2);
  });

  it("表示件数変更時は先頭ページへ戻る", async () => {
    const page = useBillingAdministrationPage();
    page.page.value = 2;

    await page.changePageSize(100);

    expect(mocks.billingApi.getAdministrationAccounts).toHaveBeenCalledWith(0, 100);
    expect(page.page.value).toBe(1);
  });

  it("読込中の再実行では課金管理一覧APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.billingApi.getAdministrationAccounts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    const page = useBillingAdministrationPage();

    const firstLoad = page.initialize();
    const secondLoad = page.initialize();

    expect(mocks.billingApi.getAdministrationAccounts).toHaveBeenCalledOnce();
    resolveRequest(response);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("401は課金一覧を破棄してSession失効処理へ渡す", async () => {
    mocks.billingApi.getAdministrationAccounts.mockRejectedValue(new BillingApiError(401, null));
    const page = useBillingAdministrationPage();

    await page.initialize();

    expect(page.accounts.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
    expect(mocks.expireSession).toHaveBeenCalledOnce();
  });

  it("403は一覧を破棄し課金参照permission不足として表示する", async () => {
    mocks.billingApi.getAdministrationAccounts.mockRejectedValue(new BillingApiError(403, null));
    const page = useBillingAdministrationPage();

    await page.initialize();

    expect(page.accounts.value).toEqual([]);
    expect(page.errorMessages.value).toEqual(["課金状態を参照するpermissionがありません。"]);
    expect(mocks.expireSession).not.toHaveBeenCalled();
  });

  it("BILLING_RECONCILEがなければ手動照合APIを呼ばない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useBillingAdministrationPage();

    await page.reconcileAccount(account);

    expect(mocks.billingApi.reconcileAdministrationAccount).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual(["課金状態を再照合するpermissionがありません。"]);
  });

  it("Customer未作成または照合中のAccountでは手動照合APIを呼ばない", async () => {
    const page = useBillingAdministrationPage();

    await page.reconcileAccount({ ...account, billingCustomerConfigured: false });
    await page.reconcileAccount({ ...account, reconciliationInProgress: true });

    expect(mocks.billingApi.reconcileAdministrationAccount).not.toHaveBeenCalled();
  });

  it("対象Accountを手動再照合し同じ一覧ページを再取得する", async () => {
    const page = useBillingAdministrationPage();
    page.page.value = 2;

    await page.reconcileAccount(account);

    expect(mocks.billingApi.reconcileAdministrationAccount).toHaveBeenCalledWith(12);
    expect(mocks.billingApi.getAdministrationAccounts).toHaveBeenCalledWith(1, 50);
    expect(page.successMessage.value).toBe(
      "課金 利用者さんの課金状態をStripe最新状態と照合しました。"
    );
  });

  it("手動照合中の再実行を無視する", async () => {
    let resolveRequest;
    mocks.billingApi.reconcileAdministrationAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    const page = useBillingAdministrationPage();

    const firstRequest = page.reconcileAccount(account);
    const secondRequest = page.reconcileAccount(account);

    expect(mocks.billingApi.reconcileAdministrationAccount).toHaveBeenCalledOnce();
    resolveRequest();
    await Promise.all([firstRequest, secondRequest]);
  });

  it("契約済み503 codeのBackend文言だけを表示する", async () => {
    mocks.billingApi.reconcileAdministrationAccount.mockRejectedValue(
      new BillingApiError(503, {
        fieldErrors: [
          {
            errorCode: "BILLING_PROVIDER_UNAVAILABLE",
            field: "billingProvider",
            message: "課金サービスを利用できません。",
          },
        ],
      })
    );
    const page = useBillingAdministrationPage();

    await page.reconcileAccount(account);

    expect(page.errorMessages.value).toEqual(["課金サービスを利用できません。"]);
  });

  it("再照合成功後の一覧再取得失敗を操作失敗と区別する", async () => {
    mocks.billingApi.getAdministrationAccounts.mockRejectedValue(new Error("network"));
    const page = useBillingAdministrationPage();

    await page.reconcileAccount(account);

    expect(page.successMessage.value).toContain("Stripe最新状態と照合しました");
    expect(page.errorMessages.value).toEqual([
      "再照合は完了しましたが、最新の課金状態を取得できませんでした。",
    ]);
  });
});
