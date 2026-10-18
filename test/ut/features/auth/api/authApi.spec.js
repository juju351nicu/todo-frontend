import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthApi, { AuthApiError } from "@/features/auth/api/authApi";
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

    await expect(AuthApi.login(payload)).resolves.toBeUndefined();

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      API_PATHS.AUTH_LOGIN,
      payload
    );
    expect(HttpClient.refreshCsrfToken).toHaveBeenCalledOnce();
  });

  it("空本文の認証失敗をstatus付き例外へ変換する", async () => {
    const response = {
      ok: false,
      status: 401,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty body")),
    };
    HttpClient.postRequest.mockResolvedValue(response);

    const promise = AuthApi.login({ loginId: "user01", password: "wrong" });

    await expect(promise).rejects.toMatchObject({
      name: "AuthApiError",
      status: 401,
      errorResponse: null,
    });
    expect(HttpClient.refreshCsrfToken).not.toHaveBeenCalled();
  });

  it("入力不正ResponseをAuthApiErrorへ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "INVALID_REQUEST_BODY",
          field: "loginId",
          message: "ログインIDを入力してください。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      AuthApi.login({ loginId: "", password: "password" })
    ).rejects.toEqual(new AuthApiError(400, errorResponse));
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
