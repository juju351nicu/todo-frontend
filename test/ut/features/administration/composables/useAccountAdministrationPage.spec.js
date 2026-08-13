import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdministrationApiError } from "@/features/administration/api/administrationApi";
import { useAccountAdministrationPage } from "@/features/administration/composables/useAccountAdministrationPage";

const mocks = vi.hoisted(() => ({
  administrationApi: {
    getAccounts: vi.fn(),
    getRoles: vi.fn(),
    updateAccountRoles: vi.fn(),
  },
  router: {
    push: vi.fn(),
  },
  userStore: {
    clearSession: vi.fn(),
    hasPermission: vi.fn(),
    memberId: 1,
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));

vi.mock("@/features/administration/api/administrationApi", async () => {
  const actual = await vi.importActual(
    "@/features/administration/api/administrationApi"
  );
  return {
    ...actual,
    default: mocks.administrationApi,
  };
});

const accounts = [
  {
    accountId: 1,
    displayName: "管理 太郎",
    email: "admin@example.com",
    status: "ACTIVE",
    roleCodes: ["SYSTEM_ADMIN"],
    version: 5,
  },
  {
    accountId: 2,
    displayName: "利用 花子",
    email: "user@example.com",
    status: "LOCKED",
    roleCodes: ["USER"],
    version: 2,
  },
];

const roles = [
  {
    roleCode: "SYSTEM_ADMIN",
    roleName: "システム管理者",
    systemRole: true,
    version: 0,
  },
  {
    roleCode: "READ_ONLY_ADMIN",
    roleName: "参照管理者",
    systemRole: true,
    version: 0,
  },
  {
    roleCode: "USER",
    roleName: "一般利用者",
    systemRole: true,
    version: 0,
  },
];

describe("useAccountAdministrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.userStore.memberId = 1;
    mocks.userStore.hasPermission.mockImplementation(
      (permissionCode) => permissionCode === "ACCOUNT_ROLE_UPDATE"
    );
    mocks.administrationApi.getAccounts.mockResolvedValue(
      accounts.map((account) => ({ ...account, roleCodes: [...account.roleCodes] }))
    );
    mocks.administrationApi.getRoles.mockResolvedValue(roles);
  });

  it("初期表示でアカウントとロールを並行取得する", async () => {
    const page = useAccountAdministrationPage();

    await page.initialize();

    expect(mocks.administrationApi.getAccounts).toHaveBeenCalledOnce();
    expect(mocks.administrationApi.getRoles).toHaveBeenCalledOnce();
    expect(page.accounts.value).toHaveLength(2);
    expect(page.roles.value).toEqual(roles);
    expect(page.isLoading.value).toBe(false);
  });

  it("表示名・メール・ロールコードを大文字小文字を区別せず検索する", async () => {
    const page = useAccountAdministrationPage();
    await page.initialize();

    page.searchText.value = "READ_ONLY";
    expect(page.filteredAccounts.value).toEqual([]);

    page.searchText.value = "USER@EXAMPLE";
    expect(page.filteredAccounts.value.map((account) => account.accountId)).toEqual([
      2,
    ]);
    page.searchText.value = "system_admin";
    expect(page.filteredAccounts.value.map((account) => account.accountId)).toEqual([
      1,
    ]);
    page.searchText.value = "一般利用者";
    expect(page.filteredAccounts.value.map((account) => account.accountId)).toEqual([
      2,
    ]);
  });

  it("検索欄をclearしてnullになっても全件表示へ戻す", async () => {
    const page = useAccountAdministrationPage();
    await page.initialize();

    page.searchText.value = null;

    expect(page.filteredAccounts.value).toHaveLength(2);
  });

  it("編集時に現在ロールを複製し、キャンセルしても一覧を変更しない", async () => {
    const page = useAccountAdministrationPage();
    await page.initialize();

    page.openRoleEditor(page.accounts.value[1]);
    page.selectedRoleCodes.value.push("READ_ONLY_ADMIN");
    page.closeRoleEditor();

    expect(page.isEditorOpen.value).toBe(false);
    expect(page.accounts.value[1].roleCodes).toEqual(["USER"]);
  });

  it("ロールを1件も選択していない場合は更新APIを呼ばない", async () => {
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);
    page.selectedRoleCodes.value = [];

    await page.saveRoles();

    expect(mocks.administrationApi.updateAccountRoles).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "ロールを1件以上選択してください。",
    ]);
  });

  it("一覧取得時のversionと選択ロールを更新し成功結果だけ一覧へ反映する", async () => {
    const updated = {
      ...accounts[1],
      roleCodes: ["READ_ONLY_ADMIN"],
      version: 3,
    };
    mocks.administrationApi.updateAccountRoles.mockResolvedValue(updated);
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);
    page.selectedRoleCodes.value = ["READ_ONLY_ADMIN"];

    await page.saveRoles();

    expect(mocks.administrationApi.updateAccountRoles).toHaveBeenCalledWith(2, {
      roleCodes: ["READ_ONLY_ADMIN"],
      version: 2,
    });
    expect(page.accounts.value[1]).toEqual(updated);
    expect(page.successMessage.value).toBe(
      "利用 花子さんのロールを更新しました。"
    );
  });

  it("保存中の再実行では更新APIを二重送信しない", async () => {
    let resolveUpdate;
    mocks.administrationApi.updateAccountRoles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);
    page.selectedRoleCodes.value = ["READ_ONLY_ADMIN"];

    const firstSave = page.saveRoles();
    const secondSave = page.saveRoles();

    expect(mocks.administrationApi.updateAccountRoles).toHaveBeenCalledOnce();
    resolveUpdate({
      ...accounts[1],
      roleCodes: ["READ_ONLY_ADMIN"],
      version: 3,
    });
    await Promise.all([firstSave, secondSave]);
  });

  it("自分のロールが変わった場合はFrontend Sessionも破棄してログインへ戻す", async () => {
    mocks.administrationApi.updateAccountRoles.mockResolvedValue({
      ...accounts[0],
      roleCodes: ["USER"],
      version: 6,
    });
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[0]);
    page.selectedRoleCodes.value = ["USER"];

    await page.saveRoles();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
    expect(page.successMessage.value).toBe("");
  });

  it("同一ロールの保存では自分のSessionを破棄しない", async () => {
    mocks.administrationApi.updateAccountRoles.mockResolvedValue(accounts[0]);
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[0]);

    await page.saveRoles();

    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("409競合ではBackendメッセージを表示して最新versionを再取得する", async () => {
    mocks.administrationApi.updateAccountRoles.mockRejectedValue(
      new AdministrationApiError(409, {
        fieldErrors: [
          {
            errorCode: "AUTHORIZATION_CONFLICT",
            field: "version",
            message: "他の操作で更新されています。再度確認してください。",
          },
        ],
      })
    );
    mocks.administrationApi.getAccounts
      .mockResolvedValueOnce(accounts)
      .mockResolvedValueOnce([{ ...accounts[1], version: 3 }]);
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);
    page.selectedRoleCodes.value = ["READ_ONLY_ADMIN"];

    await page.saveRoles();

    expect(page.errorMessages.value).toEqual([
      "他の操作で更新されています。再度確認してください。",
    ]);
    expect(mocks.administrationApi.getAccounts).toHaveBeenCalledTimes(2);
    expect(page.accounts.value[0].version).toBe(3);
    expect(page.isEditorOpen.value).toBe(false);
  });

  it("403は権限不足として表示し、Sessionを破棄しない", async () => {
    mocks.administrationApi.updateAccountRoles.mockRejectedValue(
      new AdministrationApiError(403, null)
    );
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);

    await page.saveRoles();

    expect(page.errorMessages.value).toEqual([
      "この操作を実行するpermissionがありません。",
    ]);
    expect(mocks.userStore.clearSession).not.toHaveBeenCalled();
  });

  it("401は認証切れとしてSessionを破棄しログインへ戻す", async () => {
    mocks.administrationApi.updateAccountRoles.mockRejectedValue(
      new AdministrationApiError(401, null)
    );
    const page = useAccountAdministrationPage();
    await page.initialize();
    page.openRoleEditor(page.accounts.value[1]);

    await page.saveRoles();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("更新permissionがない場合は編集Dialogと更新APIを公開しない", async () => {
    mocks.userStore.hasPermission.mockReturnValue(false);
    const page = useAccountAdministrationPage();
    await page.initialize();

    page.openRoleEditor(page.accounts.value[1]);
    await page.saveRoles();

    expect(page.isEditorOpen.value).toBe(false);
    expect(mocks.administrationApi.updateAccountRoles).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "アカウントのロールを変更するpermissionがありません。",
    ]);
  });
});
