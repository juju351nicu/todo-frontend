import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

describe("useSessionExpiry", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    useUserStore().setSessionUser({
      accountId: 7,
      username: "user07",
      displayName: "利用者",
      roleCodes: [],
      permissionCodes: [],
    });
  });

  it("画面の片付け → Session破棄 → Login遷移の順に行う", async () => {
    const userStore = useUserStore();
    const order = [];
    const cleanup = vi.fn(() => order.push(`cleanup:${userStore.accountId}`));
    mocks.router.push.mockImplementation(async () => {
      order.push(`push:${userStore.accountId}`);
    });
    const { expireSession } = useSessionExpiry();

    await expireSession(cleanup);

    // 片付けはSession情報が残っているうちに呼ばれ、遷移の時点では破棄済みになる。
    expect(order).toEqual(["cleanup:7", "push:null"]);
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });

  it("片付けを省略しても、Sessionを破棄してLoginへ戻す", async () => {
    const { expireSession } = useSessionExpiry();

    await expireSession();

    expect(useUserStore().accountId).toBeNull();
    expect(mocks.router.push).toHaveBeenCalledTimes(1);
  });

  it("続けて呼ばれても毎回Loginへ戻す（ログインし直した後の401でも戻すため）", async () => {
    const { expireSession } = useSessionExpiry();

    await expireSession();
    await expireSession();

    expect(mocks.router.push).toHaveBeenCalledTimes(2);
  });
});
