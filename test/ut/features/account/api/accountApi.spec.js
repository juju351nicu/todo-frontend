import { beforeEach, describe, expect, it, vi } from "vitest";

import AccountApi, { AccountApiError } from "@/features/account/api/accountApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

const okResponse = (body) => ({ ok: true, json: vi.fn().mockResolvedValue(body) });

describe("Account API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("アカウント一覧をGET /api/v1/accountsで取得する", async () => {
    const payload = { accounts: [] };
    HttpClient.getRequest.mockResolvedValue(okResponse(payload));

    await expect(AccountApi.findList()).resolves.toEqual(payload);

    expect(API_PATHS.ACCOUNTS).toBe("/api/v1/accounts");
    expect(HttpClient.getRequest).toHaveBeenCalledWith("/api/v1/accounts");
  });

  it("アカウント詳細をIDのpathで取得し、HTTPエラーはstatus付きのAccountApiErrorで通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 404 });

    const error = await AccountApi.findDetail(999).catch((caught) => caught);

    expect(HttpClient.getRequest).toHaveBeenCalledWith("/api/v1/accounts/999");
    expect(error).toBeInstanceOf(AccountApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("アカウントAPIの実行に失敗しました。status=404");
  });

  it("選択されたアカウントIDをquery parameterとしてDELETEへ渡す", async () => {
    const payload = { accounts: [] };
    HttpClient.deleteRequest.mockResolvedValue(okResponse(payload));

    await expect(AccountApi.deleteAccounts([1, "2"])).resolves.toEqual(payload);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith("/api/v1/accounts?ids=1&ids=2");
  });

  it("登録RequestをPOST /api/v1/accountsへ渡す", async () => {
    const request = {
      lastName: "山田",
      firstName: "太郎",
      loginId: "user01",
      password: "password",
      email: "user01@example.com",
    };
    HttpClient.postRequest.mockResolvedValue(okResponse({ accountId: 120 }));

    await expect(AccountApi.register(request)).resolves.toEqual({ accountId: 120 });

    expect(HttpClient.postRequest).toHaveBeenCalledWith("/api/v1/accounts", request);
  });

  it("更新RequestをPUT /api/v1/accounts/{id}へ渡す", async () => {
    const request = {
      lastName: "山田",
      firstName: "太郎",
      loginId: "user01",
      password: "",
      email: "user01@example.com",
      version: 3,
    };
    HttpClient.putRequest.mockResolvedValue(okResponse({ accountId: 7 }));

    await AccountApi.update(7, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith("/api/v1/accounts/7", request);
  });

  it("退会はPOST /api/v1/accounts/{id}/cancelへパスワードだけを渡す", async () => {
    HttpClient.postRequest.mockResolvedValue(okResponse({ accountId: 7 }));

    await expect(AccountApi.cancel(7, { password: "password" })).resolves.toEqual({
      accountId: 7,
    });

    expect(HttpClient.postRequest).toHaveBeenCalledWith("/api/v1/accounts/7/cancel", {
      password: "password",
    });
  });
});
