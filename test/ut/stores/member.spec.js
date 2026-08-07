import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const.js";
import { useMemberStore } from "@/stores/member.js";
import Fetcher from "@/utils/rest.js";

vi.mock("@/utils/rest.js", () => ({
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
});
