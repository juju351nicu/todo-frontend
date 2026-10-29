import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppNavigation } from "@/app/composables/useAppNavigation";
import { useUserStore } from "@/features/auth/stores/user";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

const signIn = (overrides = {}) => {
  useUserStore().setSessionUser({
    accountId: 7,
    username: "user07",
    displayName: "利用者",
    roleCodes: [],
    permissionCodes: [],
    ...overrides,
  });
};

const labelsOf = (navigation) => navigation.navigationLinks.value.map((link) => link.label);

describe("useAppNavigation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
  });

  it("permissionがない利用者にはDashboard・アカウント・退会だけを表示し、アカウントは自分の会員詳細を開く", () => {
    signIn();
    const navigation = useAppNavigation();

    expect(labelsOf(navigation)).toEqual(["Dashboard", "アカウント", "退会"]);
    expect(navigation.navigationLinks.value.map((link) => link.to)).toEqual([
      "/dashboard",
      "/member/detail/7",
      "/member/cancel/7",
    ]);
  });

  it("全permissionとSYSTEM_ADMINを持つ利用者へ既存の表示順で全項目を表示する", () => {
    signIn({
      roleCodes: ["SYSTEM_ADMIN"],
      permissionCodes: [
        "TASK_READ_OWN",
        "TASK_READ",
        "PROJECT_READ",
        "ATTENDANCE_READ_ALL",
        "ATTENDANCE_READ_OWN",
        "TASK_WRITE_OWN",
        "ACCOUNT_READ",
        "ACCOUNT_UPDATE",
        "AUTHORIZATION_AUDIT_READ",
        "NOTIFICATION_ANNOUNCEMENT_CREATE",
      ],
    });
    const navigation = useAppNavigation();

    expect(labelsOf(navigation)).toEqual([
      "Dashboard",
      "Taskカレンダー",
      "Task一覧",
      "My Tasks",
      "Task検索",
      "Project Board",
      "Project Template",
      "勤怠月次確認",
      "勤怠",
      "アカウント",
      "退会",
      "Task新規登録",
      "アカウント・ロール管理",
      "権限変更監査ログ",
      "お知らせ配信",
      "会員新規登録",
      "会員一覧",
    ]);
  });

  it("ACCOUNT_READだけの利用者（READ_ONLY_ADMIN）には会員一覧を表示し会員新規登録を表示しない", () => {
    signIn({ roleCodes: ["READ_ONLY_ADMIN"], permissionCodes: ["ACCOUNT_READ"] });
    const labels = labelsOf(useAppNavigation());

    expect(labels).toContain("会員一覧");
    expect(labels).not.toContain("会員新規登録");
  });

  it("未認証では利用者IDを含むアカウント・退会pathを作らない", () => {
    const navigation = useAppNavigation();

    expect(labelsOf(navigation)).toEqual(["Dashboard"]);
    expect(navigation.navigationLinks.value.some((link) => link.to.includes("null"))).toBe(false);
  });

  it("toggleDrawerで開閉を切り替える", () => {
    const navigation = useAppNavigation();

    navigation.toggleDrawer();
    expect(navigation.isDrawerOpen.value).toBe(true);
    navigation.toggleDrawer();
    expect(navigation.isDrawerOpen.value).toBe(false);
  });

  it("ログアウト成功時にメニューを閉じてログイン画面へ遷移する", async () => {
    signIn();
    const userStore = useUserStore();
    const logoutSpy = vi.spyOn(userStore, "logout").mockResolvedValue(undefined);
    const navigation = useAppNavigation();
    navigation.isDrawerOpen.value = true;

    await navigation.logout();

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(navigation.isDrawerOpen.value).toBe(false);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("ログアウトAPIが失敗してもログイン画面へ遷移する", async () => {
    signIn();
    vi.spyOn(useUserStore(), "logout").mockRejectedValue(new Error("network"));
    const navigation = useAppNavigation();
    navigation.isDrawerOpen.value = true;

    await expect(navigation.logout()).resolves.toBeUndefined();

    expect(navigation.isDrawerOpen.value).toBe(false);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
