import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthApi from "@/features/auth/api/authApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    clearCsrfToken: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    refreshCsrfToken: vi.fn(),
  },
}));

const sessionUser = {
  accountId: 1,
  username: "user01",
  displayName: "松浦 大地",
  roleCodes: ["SYSTEM_ADMIN"],
  permissionCodes: ["ACCOUNT_READ"],
};

describe("Auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Session APIの認証利用者を返す", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(sessionUser),
    });

    await expect(AuthApi.getSession()).resolves.toEqual(sessionUser);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.SESSION);
  });

  it("Sessionが未認証の場合はnullを返す", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 401 });

    await expect(AuthApi.getSession()).resolves.toBeNull();
  });

  it("ログイン成功後にCSRFトークンを更新する", async () => {
    const response = { ok: true, status: 204 };
    const payload = { loginId: "user01", password: "password" };
    HttpClient.postRequest.mockResolvedValue(response);
    HttpClient.refreshCsrfToken.mockResolvedValue("new-csrf-token");

    await expect(AuthApi.login(payload)).resolves.toBe(response);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      API_PATHS.AUTH_LOGIN,
      payload
    );
    expect(HttpClient.refreshCsrfToken).toHaveBeenCalledOnce();
  });

  it("ログアウト成功後にCSRFトークンを作り直す", async () => {
    const response = { ok: true, status: 204 };
    HttpClient.postRequest.mockResolvedValue(response);
    HttpClient.refreshCsrfToken.mockResolvedValue("anonymous-csrf-token");

    await expect(AuthApi.logout()).resolves.toBe(response);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      API_PATHS.LOGOUT,
      null
    );
    expect(HttpClient.clearCsrfToken).toHaveBeenCalledOnce();
    expect(HttpClient.refreshCsrfToken).toHaveBeenCalledOnce();
  });
});
