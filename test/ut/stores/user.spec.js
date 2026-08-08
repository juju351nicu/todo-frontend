import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const.js";
import { useUserStore } from "@/stores/user.js";
import Fetcher from "@/utils/rest.js";

vi.mock("@/utils/rest.js", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    refreshCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  },
}));

const sessionUser = {
  accountId: 1,
  username: "user01",
  displayName: "松浦 大地",
  roleCodes: ["SYSTEM_ADMIN"],
  permissionCodes: ["ACCOUNT_READ"],
};

describe("User store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("JSESSIONIDから現在の利用者と権限を復元する", async () => {
    Fetcher.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(sessionUser),
    });
    const store = useUserStore();

    await expect(store.restoreSession()).resolves.toBe(true);

    expect(Fetcher.getRequest).toHaveBeenCalledWith(Const.REST_PATH.SESSION);
    expect(store.isAuthenticated).toBe(true);
    expect(store.memberId).toBe(1);
    expect(store.getRole).toBe(0);
    expect(store.hasRole("SYSTEM_ADMIN")).toBe(true);
  });

  it("ログイン成功後にCSRFを更新してSessionを読み直す", async () => {
    const loginResponse = { ok: true, status: 200 };
    Fetcher.postRequest.mockResolvedValue(loginResponse);
    Fetcher.refreshCsrfToken.mockResolvedValue("new-csrf-token");
    Fetcher.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(sessionUser),
    });
    const store = useUserStore();

    await expect(store.authLogin({ loginId: "user01", password: "password" }))
      .resolves.toBe(loginResponse);

    expect(Fetcher.refreshCsrfToken).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(true);
  });

  it("ログアウト後はFrontendの認証情報とCSRFを破棄する", async () => {
    Fetcher.postRequest.mockResolvedValue({ ok: true, status: 204 });
    Fetcher.refreshCsrfToken.mockResolvedValue("anonymous-csrf-token");
    const store = useUserStore();
    store.setSessionUser(sessionUser);

    await store.logout();

    expect(Fetcher.postRequest).toHaveBeenCalledWith(Const.REST_PATH.LOGOUT, null);
    expect(store.isAuthenticated).toBe(false);
    expect(store.memberId).toBeNull();
    expect(Fetcher.clearCsrfToken).toHaveBeenCalledOnce();
    expect(Fetcher.refreshCsrfToken).toHaveBeenCalledOnce();
  });
});
