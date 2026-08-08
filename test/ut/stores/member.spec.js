import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import { useMemberStore } from "@/stores/member";
import Fetcher from "@/utils/rest";

vi.mock("@/utils/rest", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    deleteRequest: vi.fn(),
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
    Fetcher.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ memberList }),
    });
    const store = useMemberStore();

    const request = store.findMemberList();

    expect(store.isLoading).toBe(true);
    await request;
    expect(Fetcher.getRequest).toHaveBeenCalledWith(Const.REST_PATH.MEMBER_LIST);
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
    Fetcher.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(memberDetail),
    });
    const store = useMemberStore();

    const request = store.findMemberDetail(7);

    expect(store.isLoading).toBe(true);
    await expect(request).resolves.toEqual(memberDetail);
    expect(Fetcher.getRequest).toHaveBeenCalledWith(
      `${Const.REST_PATH.MEMBER_DETAIL}/7`
    );
    expect(store.isLoading).toBe(false);
  });

  it("会員詳細APIが失敗しても処理中フラグを解除する", async () => {
    Fetcher.getRequest.mockResolvedValue({ ok: false, status: 404 });
    const store = useMemberStore();

    await expect(store.findMemberDetail(999)).rejects.toThrow(
      "会員詳細の取得に失敗しました"
    );
    expect(store.isLoading).toBe(false);
  });
});
