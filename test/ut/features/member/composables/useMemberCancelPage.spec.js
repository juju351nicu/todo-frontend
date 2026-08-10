import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMemberCancelPage } from "@/features/member/composables/useMemberCancelPage";

const mocks = vi.hoisted(() => ({
  memberStore: {
    cancelMemberInfo: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("@/features/member/stores/member", () => ({
  useMemberStore: () => mocks.memberStore,
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
    mocks.memberStore.cancelMemberInfo.mockResolvedValue(null);
    const page = useMemberCancelPage(ref(7));

    await page.confirmCancellation();

    expect(page.message.value).toContain("退会処理に失敗しました");
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
