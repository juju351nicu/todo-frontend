import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMemberDetailPage } from "@/features/member/composables/useMemberDetailPage";

const mocks = vi.hoisted(() => ({
  memberStore: {
    findMemberDetail: vi.fn(),
    isLoading: false,
    upsertMemberInfo: vi.fn(),
  },
}));

vi.mock("@/features/member/stores/member", () => ({
  useMemberStore: () => mocks.memberStore,
}));

describe("useMemberDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.memberStore.isLoading = false;
    mocks.memberStore.upsertMemberInfo.mockResolvedValue(null);
  });

  it("会員IDに対応する詳細をパスワードなしでフォームへ設定する", async () => {
    mocks.memberStore.findMemberDetail.mockResolvedValue({
      memberId: 7,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      email: "yamada@example.com",
      role: 2,
      version: 3,
    });

    const page = useMemberDetailPage(ref(7));

    await vi.waitFor(() => {
      expect(page.memberForm.memberId).toBe(7);
    });
    expect(page.memberForm.password).toBe("");
    expect(mocks.memberStore.findMemberDetail).toHaveBeenCalledWith(7);
  });

  it("新規登録では詳細APIを呼ばず初期フォームを使用する", async () => {
    const page = useMemberDetailPage(ref(0));

    await Promise.resolve();

    expect(mocks.memberStore.findMemberDetail).not.toHaveBeenCalled();
    expect(page.memberForm).toMatchObject({ memberId: 0, role: 2 });
    // 新規登録はユーザとしてだけ登録できる（ロールは会員画面では変えられない）。
    expect(page.roleLabel.value).toBe("ユーザ");
  });

  it("既存会員の権限は表示名で示し、選択肢は出さない", async () => {
    mocks.memberStore.findMemberDetail.mockResolvedValue({
      memberId: 1,
      lastName: "管理",
      firstName: "一郎",
      loginId: "admin",
      email: "admin@example.com",
      role: 0,
      version: 1,
    });

    const page = useMemberDetailPage(ref(1));

    await vi.waitFor(() => {
      expect(page.roleLabel.value).toBe("管理者");
    });
    expect("roleItems" in page).toBe(false);
  });

  it("詳細取得失敗時は画面用メッセージを設定する", async () => {
    mocks.memberStore.findMemberDetail.mockRejectedValue(new Error("not found"));

    const page = useMemberDetailPage(ref(999));

    await vi.waitFor(() => {
      expect(page.loadError.value).toContain("会員情報を取得できませんでした");
    });
  });

  it("確認したフォームを登録更新RequestとしてStoreへ渡す", async () => {
    const page = useMemberDetailPage(ref(0));
    Object.assign(page.memberForm, {
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "password",
      email: "yamada@example.com",
      role: 2,
    });
    page.openConfirm();

    await page.confirmSubmit();

    expect(page.isShowConfirm.value).toBe(false);
    expect(mocks.memberStore.upsertMemberInfo).toHaveBeenCalledWith({
      memberId: 0,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      password: "password",
      email: "yamada@example.com",
      role: 2,
      version: 0,
    });
  });
});
