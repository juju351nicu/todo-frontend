import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberApi from "@/features/member/api/memberApi";
import { useMemberStore } from "@/features/member/stores/member";

vi.mock("@/features/member/api/memberApi", () => ({
  default: {
    cancel: vi.fn(),
    deleteMembers: vi.fn(),
    findDetail: vi.fn(),
    findList: vi.fn(),
    upsert: vi.fn(),
  },
}));

describe("Member store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("会員一覧APIのレスポンスをStoreへ設定する", async () => {
    const memberList = [
      { memberId: 1, lastName: "山田", firstName: "太郎" },
      { memberId: 2, lastName: "佐藤", firstName: "花子" },
    ];
    MemberApi.findList.mockResolvedValue({ memberList });
    const store = useMemberStore();

    const request = store.findMemberList();

    expect(store.isLoading).toBe(true);
    await request;
    expect(MemberApi.findList).toHaveBeenCalledOnce();
    expect(store.memberListInfo).toEqual(memberList);
    expect(store.isLoading).toBe(false);
  });

  it("ID指定で会員詳細を取得し、処理中フラグを解除する", async () => {
    const memberDetail = {
      memberId: 7,
      lastName: "山田",
      firstName: "太郎",
      loginId: "yamada",
      email: "yamada@example.com",
      role: 2,
      version: 3,
    };
    MemberApi.findDetail.mockResolvedValue(memberDetail);
    const store = useMemberStore();

    const request = store.findMemberDetail(7);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(memberDetail);
    expect(MemberApi.findDetail).toHaveBeenCalledWith(7);
    expect(store.isLoading).toBe(false);
  });

  it("会員詳細APIが失敗しても処理中フラグを解除する", async () => {
    MemberApi.findDetail.mockRejectedValue(
      new Error("会員詳細の取得に失敗しました。status=404")
    );
    const store = useMemberStore();

    await expect(store.findMemberDetail(999)).rejects.toThrow(
      "会員詳細の取得に失敗しました"
    );
    expect(store.isLoading).toBe(false);
  });
});
