import { beforeEach, describe, expect, it, vi } from "vitest";

import AdministrationApi, {
  AdministrationApiError,
} from "@/features/administration/api/administrationApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

describe("Administration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("アカウントと現在ロールの一覧を取得する", async () => {
    const accounts = [{ accountId: 1, roleCodes: ["SYSTEM_ADMIN"] }];
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ accounts }),
    });

    await expect(AdministrationApi.getAccounts()).resolves.toEqual(accounts);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      API_PATHS.ADMINISTRATION_ACCOUNTS
    );
  });

  it("一覧Responseの配列がない場合は空配列として扱う", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });

    await expect(AdministrationApi.getAccounts()).resolves.toEqual([]);
  });

  it("選択可能ロールを取得する", async () => {
    const roles = [{ roleCode: "USER", roleName: "一般利用者" }];
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ roles }),
    });

    await expect(AdministrationApi.getRoles()).resolves.toEqual(roles);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      API_PATHS.ADMINISTRATION_ROLES
    );
  });

  it("ロール集合と楽観ロックversionを更新APIへ渡す", async () => {
    const updated = {
      accountId: 2,
      displayName: "利用者",
      roleCodes: ["READ_ONLY_ADMIN"],
      version: 4,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(updated),
    });

    await expect(
      AdministrationApi.updateAccountRoles(2, {
        roleCodes: ["READ_ONLY_ADMIN"],
        version: 3,
      })
    ).resolves.toEqual(updated);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/administration/accounts/2/roles",
      { roleCodes: ["READ_ONLY_ADMIN"], version: 3 }
    );
  });

  it("Backendの409項目エラーをstatus付き例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "AUTHORIZATION_CONFLICT",
          field: "version",
          message: "他の操作で更新されています。",
        },
      ],
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: false,
      status: 409,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    const promise = AdministrationApi.updateAccountRoles(2, {
      roleCodes: ["USER"],
      version: 1,
    });

    await expect(promise).rejects.toMatchObject({
      name: "AdministrationApiError",
      status: 409,
      errorResponse,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(AdministrationApiError)
    );
  });

  it("JSON本文がない403もstatus付き例外へ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    await expect(AdministrationApi.getAccounts()).rejects.toMatchObject({
      status: 403,
      errorResponse: null,
    });
  });

  it("0始まりページ番号と表示件数を監査ログAPIへ渡す", async () => {
    const payload = {
      auditLogs: [],
      page: 1,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(
      AdministrationApi.getAuthorizationAuditLogs(1, 20)
    ).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/administration/authorization-audit-logs?page=1&size=20"
    );
  });
});
