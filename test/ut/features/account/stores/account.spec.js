import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountApi from "@/features/account/api/accountApi";
import { useAccountStore } from "@/features/account/stores/account";

vi.mock("@/features/account/api/accountApi", () => ({
  default: {
    cancel: vi.fn(),
    deleteAccounts: vi.fn(),
    findDetail: vi.fn(),
    findList: vi.fn(),
    register: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Account store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("アカウント一覧APIのレスポンスをStoreへ設定する", async () => {
    const accounts = [
      { accountId: 1, lastName: "山田", firstName: "太郎" },
      { accountId: 2, lastName: "佐藤", firstName: "花子" },
    ];
    AccountApi.findList.mockResolvedValue({ accounts });
    const store = useAccountStore();

    const request = store.findAccountList();

    expect(store.isLoading).toBe(true);
    await request;
    expect(AccountApi.findList).toHaveBeenCalledOnce();
    expect(store.accounts).toEqual(accounts);
    expect(store.isLoading).toBe(false);
  });

  it("アカウントを削除したら、Backendが返した削除後の一覧でStoreを置き換える", async () => {
    const remaining = [{ accountId: 1, lastName: "山田", firstName: "太郎" }];
    AccountApi.deleteAccounts.mockResolvedValue({ accounts: remaining });
    const store = useAccountStore();
    store.accounts = [...remaining, { accountId: 2, lastName: "佐藤", firstName: "花子" }];

    await store.deleteAccounts([2]);

    expect(AccountApi.deleteAccounts).toHaveBeenCalledWith([2]);
    expect(store.accounts).toEqual(remaining);
  });

  it("削除に失敗した場合は一覧を変えず、例外を画面へ渡す", async () => {
    const failure = new Error("403");
    AccountApi.deleteAccounts.mockRejectedValue(failure);
    const store = useAccountStore();
    const current = [{ accountId: 2, lastName: "佐藤", firstName: "花子" }];
    store.accounts = current;

    await expect(store.deleteAccounts([2])).rejects.toBe(failure);
    expect(store.isLoading).toBe(false);
    expect(store.accounts).toEqual(current);
  });

  it("ID指定でアカウント詳細を取得し、処理中フラグを解除する", async () => {
    const detail = { accountId: 7, lastName: "山田", firstName: "太郎", version: 3 };
    AccountApi.findDetail.mockResolvedValue(detail);
    const store = useAccountStore();

    const request = store.findAccountDetail(7);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(detail);
    expect(AccountApi.findDetail).toHaveBeenCalledWith(7);
    expect(store.isLoading).toBe(false);
  });

  it("アカウント詳細APIが失敗しても処理中フラグを解除する", async () => {
    AccountApi.findDetail.mockRejectedValue(new Error("status=404"));
    const store = useAccountStore();

    await expect(store.findAccountDetail(999)).rejects.toThrow("status=404");
    expect(store.isLoading).toBe(false);
  });

  it("登録・更新・退会はそれぞれのAPIへ渡し、終わったら処理中フラグを解除する", async () => {
    AccountApi.register.mockResolvedValue({ accountId: 120 });
    AccountApi.update.mockResolvedValue({ accountId: 7 });
    AccountApi.cancel.mockResolvedValue({ accountId: 7 });
    const store = useAccountStore();
    const registerRequest = { lastName: "山田", firstName: "太郎" };
    const updateRequest = { lastName: "山田", firstName: "太郎", version: 3 };

    await store.registerAccount(registerRequest);
    await store.updateAccount(7, updateRequest);
    await store.cancelAccount(7, { password: "password" });

    expect(AccountApi.register).toHaveBeenCalledWith(registerRequest);
    expect(AccountApi.update).toHaveBeenCalledWith(7, updateRequest);
    expect(AccountApi.cancel).toHaveBeenCalledWith(7, { password: "password" });
    expect(store.isLoading).toBe(false);
  });
});
