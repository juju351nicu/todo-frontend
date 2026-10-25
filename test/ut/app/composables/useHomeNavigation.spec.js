import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useHomeNavigation } from "@/app/composables/useHomeNavigation";
import { useUserStore } from "@/features/auth/stores/user";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

describe("useHomeNavigation", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
  });

  it("未認証ならログイン画面へ遷移する", async () => {
    await useHomeNavigation().goHome();

    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("認証済みならpermissionに応じたDashboardへ遷移する", async () => {
    useUserStore().setSessionUser({
      accountId: 1,
      username: "user01",
      displayName: "利用者",
      roleCodes: [],
      permissionCodes: ["TASK_READ_OWN"],
    });

    await useHomeNavigation().goHome();

    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Dashboard" });
  });
});
