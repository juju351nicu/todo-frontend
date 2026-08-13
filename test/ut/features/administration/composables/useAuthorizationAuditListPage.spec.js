import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdministrationApiError } from "@/features/administration/api/administrationApi";
import { useAuthorizationAuditListPage } from "@/features/administration/composables/useAuthorizationAuditListPage";

const mocks = vi.hoisted(() => ({
  administrationApi: {
    getAuthorizationAuditLogs: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
}));

vi.mock("vue-router", () => ({ useRouter: () => mocks.router }));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/administration/api/administrationApi", async () => {
  const actual = await vi.importActual(
    "@/features/administration/api/administrationApi"
  );
  return { ...actual, default: mocks.administrationApi };
});

const auditLog = {
  authorizationAuditLogId: 11,
  actorAccountId: 1,
  actorDisplayName: "管理 太郎",
  targetAccountId: 2,
  targetDisplayName: "利用 花子",
  action: "ROLE_ASSIGNED",
  roleCode: "READ_ONLY_ADMIN",
  beforeRoleCodes: ["USER"],
  afterRoleCodes: ["READ_ONLY_ADMIN"],
  occurredAt: "2026-08-13T16:23:45Z",
};

const response = {
  auditLogs: [auditLog],
  page: 0,
  size: 50,
  totalElements: 51,
  totalPages: 2,
};

describe("useAuthorizationAuditListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.administrationApi.getAuthorizationAuditLogs.mockResolvedValue(
      response
    );
  });

  it("初期表示でBackendの先頭ページを取得する", async () => {
    const page = useAuthorizationAuditListPage();

    await page.initialize();

    expect(mocks.administrationApi.getAuthorizationAuditLogs).toHaveBeenCalledWith(
      0,
      50
    );
    expect(page.auditLogs.value).toEqual([auditLog]);
    expect(page.totalElements.value).toBe(51);
    expect(page.totalPages.value).toBe(2);
  });

  it("画面の1始まりページ番号をBackendの0始まりへ変換する", async () => {
    mocks.administrationApi.getAuthorizationAuditLogs.mockResolvedValue({
      ...response,
      page: 1,
    });
    const page = useAuthorizationAuditListPage();

    await page.changePage(2);

    expect(mocks.administrationApi.getAuthorizationAuditLogs).toHaveBeenCalledWith(
      1,
      50
    );
    expect(page.page.value).toBe(2);
  });

  it("表示件数変更時は先頭ページへ戻る", async () => {
    const page = useAuthorizationAuditListPage();
    page.page.value = 2;

    await page.changePageSize(100);

    expect(mocks.administrationApi.getAuthorizationAuditLogs).toHaveBeenCalledWith(
      0,
      100
    );
    expect(page.page.value).toBe(1);
  });

  it("読込中の再実行では監査APIを二重送信しない", async () => {
    let resolveRequest;
    mocks.administrationApi.getAuthorizationAuditLogs.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    const page = useAuthorizationAuditListPage();

    const firstLoad = page.initialize();
    const secondLoad = page.initialize();

    expect(mocks.administrationApi.getAuthorizationAuditLogs).toHaveBeenCalledOnce();
    resolveRequest(response);
    await Promise.all([firstLoad, secondLoad]);
  });

  it("空一覧Responseを空配列として表示する", async () => {
    mocks.administrationApi.getAuthorizationAuditLogs.mockResolvedValue({
      ...response,
      auditLogs: undefined,
      totalElements: 0,
      totalPages: 0,
    });
    const page = useAuthorizationAuditListPage();

    await page.initialize();

    expect(page.auditLogs.value).toEqual([]);
  });

  it("401はSessionを破棄してログインへ戻す", async () => {
    mocks.administrationApi.getAuthorizationAuditLogs.mockRejectedValue(
      new AdministrationApiError(401, null)
    );
    const page = useAuthorizationAuditListPage();

    await page.initialize();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("403は監査ログ参照permission不足として表示する", async () => {
    mocks.administrationApi.getAuthorizationAuditLogs.mockRejectedValue(
      new AdministrationApiError(403, null)
    );
    const page = useAuthorizationAuditListPage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual([
      "監査ログを参照するpermissionがありません。",
    ]);
  });

  it("400項目エラーはBackendメッセージを表示する", async () => {
    mocks.administrationApi.getAuthorizationAuditLogs.mockRejectedValue(
      new AdministrationApiError(400, {
        fieldErrors: [
          { field: "size", message: "100以下で指定してください。" },
        ],
      })
    );
    const page = useAuthorizationAuditListPage();

    await page.initialize();

    expect(page.errorMessages.value).toEqual(["100以下で指定してください。"]);
  });
});
