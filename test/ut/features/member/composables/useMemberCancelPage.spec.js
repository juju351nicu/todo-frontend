import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemberApiError } from "@/features/member/api/memberApi";
import { useMemberCancelPage } from "@/features/member/composables/useMemberCancelPage";

const mocks = vi.hoisted(() => ({
  expireSession: vi.fn(),
  memberStore: {
    cancelMemberInfo: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("@/features/member/stores/member", () => ({
  useMemberStore: () => mocks.memberStore,
}));

vi.mock("@/features/auth/composables/useSessionExpiry", () => ({
  useSessionExpiry: () => ({ expireSession: mocks.expireSession }),
}));

describe("useMemberCancelPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.memberStore.isLoading = false;
  });

  it("会員IDと入力されたパスワードを退会処理へ渡す", async () => {
    mocks.memberStore.cancelMemberInfo.mockResolvedValue({ memberId: 7 });
    const page = useMemberCancelPage(ref(7));
    page.password.value = "password";

    await page.confirmCancellation();

    expect(mocks.memberStore.cancelMemberInfo).toHaveBeenCalledWith({
      memberId: 7,
      password: "password",
    });
    expect(page.message.value).toBe("");
  });

  it("退会失敗時は利用者向けメッセージを設定する", async () => {
    mocks.memberStore.cancelMemberInfo.mockRejectedValue(new MemberApiError(400, null));
    const page = useMemberCancelPage(ref(7));

    await page.confirmCancellation();

    expect(page.message.value).toContain("退会処理に失敗しました");
    expect(mocks.expireSession).not.toHaveBeenCalled();
  });

  it("Sessionが切れていた（401）場合は、パスワードを捨ててログイン画面へ戻す", async () => {
    mocks.memberStore.cancelMemberInfo.mockRejectedValue(new MemberApiError(401, null));
    mocks.expireSession.mockImplementation(async (cleanup) => cleanup());
    const page = useMemberCancelPage(ref(7));
    page.password.value = "password";

    await page.confirmCancellation();

    expect(mocks.expireSession).toHaveBeenCalledOnce();
    expect(page.password.value).toBe("");
    expect(page.message.value).toBe("");
  });

  it("クリア操作でパスワードとメッセージを消去する", () => {
    const page = useMemberCancelPage(ref(7));
    page.password.value = "password";
    page.message.value = "error";

    page.clearPassword();

    expect(page.password.value).toBe("");
    expect(page.message.value).toBe("");
  });
});
