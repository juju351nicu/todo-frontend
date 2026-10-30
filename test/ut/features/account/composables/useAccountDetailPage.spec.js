import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountApiError } from "@/features/account/api/accountApi";
import { useAccountDetailPage } from "@/features/account/composables/useAccountDetailPage";

const mocks = vi.hoisted(() => ({
  expireSession: vi.fn(),
  accountStore: {
    findAccountDetail: vi.fn(),
    isLoading: false,
    registerAccount: vi.fn(),
    updateAccount: vi.fn(),
  },
}));

vi.mock("@/features/account/stores/account", () => ({
  useAccountStore: () => mocks.accountStore,
}));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

const DETAIL = {
  accountId: 7,
  lastName: "山田",
  firstName: "太郎",
  loginId: "yamada",
  email: "yamada@example.com",
  version: 3,
  roleNames: ["システム管理者", "勤怠管理者"],
};

describe("useAccountDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountStore.isLoading = false;
    mocks.accountStore.registerAccount.mockResolvedValue({ accountId: 120 });
    mocks.accountStore.updateAccount.mockResolvedValue({ accountId: 7 });
  });

  it("アカウントIDに対応する詳細を、姓・名を入れ替えずパスワードなしでフォームへ設定する", async () => {
    mocks.accountStore.findAccountDetail.mockResolvedValue(DETAIL);

    const page = useAccountDetailPage(ref(7));

    await vi.waitFor(() => {
      expect(page.accountForm.accountId).toBe(7);
    });
    expect(page.accountForm.lastName).toBe("山田");
    expect(page.accountForm.firstName).toBe("太郎");
    expect(page.accountForm.password).toBe("");
    expect(mocks.accountStore.findAccountDetail).toHaveBeenCalledWith(7);
  });

  it("新規登録では詳細APIを呼ばず初期フォームを使い、権限はユーザと示す", async () => {
    const page = useAccountDetailPage(ref(0));

    await Promise.resolve();

    expect(mocks.accountStore.findAccountDetail).not.toHaveBeenCalled();
    expect(page.accountForm).toMatchObject({ accountId: 0, roleNames: [] });
    expect(page.roleLabel.value).toBe("ユーザ");
  });

  it("既存アカウントの権限はロールの表示名を並べて示し、選択肢は出さない", async () => {
    mocks.accountStore.findAccountDetail.mockResolvedValue(DETAIL);

    const page = useAccountDetailPage(ref(7));

    await vi.waitFor(() => {
      expect(page.roleLabel.value).toBe("システム管理者、勤怠管理者");
    });
    expect("roleItems" in page).toBe(false);
  });

  it("詳細取得失敗時は画面用メッセージを設定する", async () => {
    mocks.accountStore.findAccountDetail.mockRejectedValue(new Error("not found"));

    const page = useAccountDetailPage(ref(999));

    await vi.waitFor(() => {
      expect(page.loadError.value).toContain("アカウント情報を取得できませんでした");
    });
  });

  it("新規登録では、確認したフォームをロールなしの登録RequestとしてStoreへ渡す", async () => {
    const page = useAccountDetailPage(ref(0));
    Object.assign(page.accountForm, {
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "password",
      email: "yamada@example.com",
    });
    page.openConfirm();

    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.accountStore.registerAccount).toHaveBeenCalledWith({
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "password",
      email: "yamada@example.com",
    });
    expect(mocks.accountStore.updateAccount).not.toHaveBeenCalled();
    expect(page.submitError.value).toBe("");
  });

  it("既存アカウントでは、versionを付けた更新RequestをアカウントIDとともにStoreへ渡す", async () => {
    mocks.accountStore.findAccountDetail.mockResolvedValue(DETAIL);
    const page = useAccountDetailPage(ref(7));
    await vi.waitFor(() => {
      expect(page.accountForm.accountId).toBe(7);
    });
    page.accountForm.email = "updated@example.com";

    await page.confirmSubmit();

    expect(mocks.accountStore.updateAccount).toHaveBeenCalledWith(7, {
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "",
      email: "updated@example.com",
      version: 3,
    });
    expect(mocks.accountStore.registerAccount).not.toHaveBeenCalled();
  });

  it.each([
    [400, "アカウント情報を保存できませんでした。入力内容を確認してください。"],
    [403, "このアカウント情報を変更する権限がありません。"],
  ])("保存が%iで失敗したら理由を出す", async (status, expected) => {
    mocks.accountStore.registerAccount.mockRejectedValue(new AccountApiError(status, null));
    const page = useAccountDetailPage(ref(0));

    await page.confirmSubmit();

    expect(page.submitError.value).toBe(expected);
    expect(mocks.expireSession).not.toHaveBeenCalled();
  });

  it("保存でSessionが切れていた（401）場合は、パスワードを含むフォームを捨ててログイン画面へ戻す", async () => {
    mocks.accountStore.registerAccount.mockRejectedValue(new AccountApiError(401, null));
    mocks.expireSession.mockImplementation(async (cleanup) => cleanup());
    const page = useAccountDetailPage(ref(0));
    page.accountForm.password = "password";

    await page.confirmSubmit();

    expect(mocks.expireSession).toHaveBeenCalledOnce();
    expect(page.accountForm.password).toBe("");
    expect(page.submitError.value).toBe("");
  });
});
