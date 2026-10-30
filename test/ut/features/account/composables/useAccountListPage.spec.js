import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountApiError } from "@/features/account/api/accountApi";
import {
  formatAccountDateTime,
  useAccountListPage,
} from "@/features/account/composables/useAccountListPage";

const mocks = vi.hoisted(() => ({
  expireSession: vi.fn(),
  router: {
    push: vi.fn(),
  },
  userStore: {
    hasPermission: vi.fn(),
  },
  accountStore: {
    accounts: [],
    deleteAccounts: vi.fn(),
    findAccountList: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/account/stores/account", () => ({
  useAccountStore: () => mocks.accountStore,
}));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

describe("useAccountListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountStore.isLoading = false;
    mocks.accountStore.accounts = [];
    mocks.accountStore.findAccountList.mockResolvedValue({ accounts: [] });
    mocks.accountStore.deleteAccounts.mockResolvedValue({ accounts: [] });
    mocks.userStore.hasPermission.mockReturnValue(false);
  });

  it("アカウントの削除はACCOUNT_UPDATEを持つ利用者にだけ出す", () => {
    expect(useAccountListPage().canDeleteAccounts.value).toBe(false);

    mocks.userStore.hasPermission.mockImplementation((code) => code === "ACCOUNT_UPDATE");
    expect(useAccountListPage().canDeleteAccounts.value).toBe(true);
  });

  it("画面初期化時にアカウント一覧を取得する", async () => {
    const page = useAccountListPage();

    await page.initialize();

    expect(mocks.accountStore.findAccountList).toHaveBeenCalledOnce();
  });

  it("削除に失敗したら、選択を残して理由を出す（403は権限の文言）", async () => {
    mocks.accountStore.deleteAccounts.mockRejectedValue(new AccountApiError(403, null));
    const page = useAccountListPage();
    page.selectedIds.value = [1, 3];

    await page.deleteSelectedAccounts();

    expect(mocks.accountStore.deleteAccounts).toHaveBeenCalledWith([1, 3]);
    expect(page.selectedIds.value).toEqual([1, 3]);
    expect(page.errorMessages.value).toEqual(["アカウントを削除する権限がありません。"]);
  });

  it("一覧の取得に失敗したら理由を出す", async () => {
    mocks.accountStore.findAccountList.mockRejectedValue(new AccountApiError(500, null));
    const page = useAccountListPage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual([
      "アカウント一覧を取得できませんでした。時間をおいて再読み込みしてください。",
    ]);
  });

  it("Sessionが切れていた（401）場合は、選択を捨ててログイン画面へ戻す", async () => {
    mocks.accountStore.deleteAccounts.mockRejectedValue(new AccountApiError(401, null));
    mocks.expireSession.mockImplementation(async (cleanup) => cleanup());
    const page = useAccountListPage();
    page.selectedIds.value = [1, 3];

    await page.deleteSelectedAccounts();

    expect(mocks.expireSession).toHaveBeenCalledOnce();
    expect(page.selectedIds.value).toEqual([]);
    expect(page.errorMessages.value).toEqual([]);
  });

  it("削除できたら、消えた行の選択を外す", async () => {
    mocks.accountStore.deleteAccounts.mockResolvedValue({ accounts: [] });
    const page = useAccountListPage();
    page.selectedIds.value = [1, 3];

    await page.deleteSelectedAccounts();

    expect(page.selectedIds.value).toEqual([]);
  });

  it("アカウント設定画面へアカウントID付きで移動する", () => {
    const page = useAccountListPage();

    page.showAccountDetail({ accountId: 7 });

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "AccountDetail",
      params: { id: 7 },
    });
  });

  it("パスワードとメールアドレスをアカウント一覧の表示項目に含めない", () => {
    const page = useAccountListPage();

    const keys = page.headers.map((header) => header.key);
    expect(keys).not.toContain("password");
    expect(keys).not.toContain("email");
    expect(keys).toEqual(
      expect.arrayContaining(["accountId", "createdAt", "updatedAt", "lastLoginAt"])
    );
  });
});

describe("formatAccountDateTime", () => {
  it("BackendのISO日時を短い日付・時刻にする", () => {
    expect(formatAccountDateTime("2026-10-27T16:14:59.244")).toBe("2026/10/27 16:14");
  });

  it("未ログイン等のnullは空欄にする", () => {
    expect(formatAccountDateTime(null)).toBe("");
  });
});
