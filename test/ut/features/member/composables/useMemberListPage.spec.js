import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMemberListPage } from "@/features/member/composables/useMemberListPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  memberStore: {
    deleteMemberList: vi.fn(),
    findMemberList: vi.fn(),
    isLoading: false,
    memberListInfo: [],
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/features/member/stores/member", () => ({
  useMemberStore: () => mocks.memberStore,
}));

describe("useMemberListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.memberStore.isLoading = false;
    mocks.memberStore.memberListInfo = [];
    mocks.memberStore.findMemberList.mockResolvedValue(null);
    mocks.memberStore.deleteMemberList.mockResolvedValue(null);
  });

  it("画面初期化時に会員一覧を取得する", async () => {
    const page = useMemberListPage();

    await page.initialize();

    expect(mocks.memberStore.findMemberList).toHaveBeenCalledOnce();
  });

  it("選択された会員IDを削除処理へ渡す", async () => {
    const page = useMemberListPage();
    page.selectedIds.value = [1, 3];

    await page.deleteSelectedMembers();

    expect(mocks.memberStore.deleteMemberList).toHaveBeenCalledWith([1, 3]);
  });

  it("会員詳細画面へ会員ID付きで移動する", () => {
    const page = useMemberListPage();

    page.showMemberDetail({ memberId: 7 });

    expect(mocks.router.push).toHaveBeenCalledWith({
      name: "MemberDetail",
      params: { id: 7 },
    });
  });

  it("パスワードを会員一覧の表示項目に含めない", () => {
    const page = useMemberListPage();

    expect(page.headers.map((header) => header.key)).not.toContain("password");
  });
});
