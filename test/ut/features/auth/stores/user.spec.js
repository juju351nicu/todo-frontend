import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthApi from "@/features/auth/api/authApi";
import { useUserStore } from "@/features/auth/stores/user";

vi.mock("@/features/auth/api/authApi", () => ({
  default: {
    getSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
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
    AuthApi.getSession.mockResolvedValue(sessionUser);
    const store = useUserStore();

    await expect(store.restoreSession()).resolves.toBe(true);

    expect(AuthApi.getSession).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(true);
    expect(store.memberId).toBe(1);
    expect(store.getRole).toBe(0);
    expect(store.hasRole("SYSTEM_ADMIN")).toBe(true);
  });

  it("ログイン成功後にCSRFを更新してSessionを読み直す", async () => {
    const loginResponse = { ok: true, status: 200 };
    AuthApi.login.mockResolvedValue(loginResponse);
    AuthApi.getSession.mockResolvedValue(sessionUser);
    const store = useUserStore();

    await expect(store.authLogin({ loginId: "user01", password: "password" }))
      .resolves.toBe(loginResponse);

    expect(AuthApi.login).toHaveBeenCalledWith({
      loginId: "user01",
      password: "password",
    });
    expect(store.isAuthenticated).toBe(true);
  });

  it("ログアウト後はFrontendの認証情報とCSRFを破棄する", async () => {
    AuthApi.logout.mockResolvedValue({ ok: true, status: 204 });
    const store = useUserStore();
    store.setSessionUser(sessionUser);

    await store.logout();

    expect(AuthApi.logout).toHaveBeenCalledOnce();
    expect(store.isAuthenticated).toBe(false);
    expect(store.memberId).toBeNull();
  });
});
