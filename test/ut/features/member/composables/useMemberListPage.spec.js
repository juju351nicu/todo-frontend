import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatMemberDateTime,
  useMemberListPage,
} from "@/features/member/composables/useMemberListPage";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
  },
  userStore: {
    hasPermission: vi.fn(),
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

vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
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
    mocks.userStore.hasPermission.mockReturnValue(false);
  });

  it("会員の削除はACCOUNT_UPDATEを持つ利用者にだけ出す", () => {
    expect(useMemberListPage().canDeleteMembers.value).toBe(false);

    mocks.userStore.hasPermission.mockImplementation((code) => code === "ACCOUNT_UPDATE");
    expect(useMemberListPage().canDeleteMembers.value).toBe(true);
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
    // 削除に失敗した（storeがnullを返した）場合は、選択を残して再操作できるようにする。
    expect(page.selectedIds.value).toEqual([1, 3]);
  });

  it("削除できたら、消えた行の選択を外す", async () => {
    mocks.memberStore.deleteMemberList.mockResolvedValue({ memberList: [] });
    const page = useMemberListPage();
    page.selectedIds.value = [1, 3];

    await page.deleteSelectedMembers();

    expect(page.selectedIds.value).toEqual([]);
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

describe("formatMemberDateTime", () => {
  it("BackendのISO日時を短い日付・時刻にする", () => {
    expect(formatMemberDateTime("2026-10-27T16:14:59.244")).toBe(
      "2026/10/27 16:14"
    );
  });

  it("未ログイン等のnullは空欄にする", () => {
    expect(formatMemberDateTime(null)).toBe("");
  });
});
