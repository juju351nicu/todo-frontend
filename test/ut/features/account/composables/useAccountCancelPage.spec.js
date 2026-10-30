import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountApiError } from "@/features/account/api/accountApi";
import { useAccountCancelPage } from "@/features/account/composables/useAccountCancelPage";

const mocks = vi.hoisted(() => ({
  expireSession: vi.fn(),
  accountStore: {
    cancelAccount: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("@/features/account/stores/account", () => ({
  useAccountStore: () => mocks.accountStore,
}));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

describe("useAccountCancelPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accountStore.isLoading = false;
  });

  it("アカウントIDと入力されたパスワードを退会処理へ渡す", async () => {
    mocks.accountStore.cancelAccount.mockResolvedValue({ accountId: 7 });
    const page = useAccountCancelPage(ref(7));
    page.password.value = "password";

    await page.confirmCancellation();

    expect(mocks.accountStore.cancelAccount).toHaveBeenCalledWith(7, { password: "password" });
    expect(page.message.value).toBe("");
  });

  it("退会失敗時は利用者向けメッセージを設定する", async () => {
    mocks.accountStore.cancelAccount.mockRejectedValue(new AccountApiError(400, null));
    const page = useAccountCancelPage(ref(7));

    await page.confirmCancellation();

    expect(page.message.value).toContain("退会処理に失敗しました");
    expect(mocks.expireSession).not.toHaveBeenCalled();
  });

  it("Sessionが切れていた（401）場合は、パスワードを捨ててログイン画面へ戻す", async () => {
    mocks.accountStore.cancelAccount.mockRejectedValue(new AccountApiError(401, null));
    mocks.expireSession.mockImplementation(async (cleanup) => cleanup());
    const page = useAccountCancelPage(ref(7));
    page.password.value = "password";

    await page.confirmCancellation();

    expect(mocks.expireSession).toHaveBeenCalledOnce();
    expect(page.password.value).toBe("");
    expect(page.message.value).toBe("");
  });

  it("クリア操作でパスワードとメッセージを消去する", () => {
    const page = useAccountCancelPage(ref(7));
    page.password.value = "password";
    page.message.value = "error";

    page.clearPassword();

    expect(page.password.value).toBe("");
    expect(page.message.value).toBe("");
  });
});
