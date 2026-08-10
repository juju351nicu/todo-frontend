import { beforeEach, describe, expect, it, vi } from "vitest";

import Const from "@/constants/const";
import MemberApi from "@/features/member/api/memberApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

describe("Member API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("会員一覧を取得する", async () => {
    const payload = { memberId: 1, memberList: [], ids: [], role: 2 };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(MemberApi.findList()).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      Const.REST_PATH.MEMBER_LIST
    );
  });

  it("会員詳細取得のHTTPエラーを操作名付きで通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 404 });

    await expect(MemberApi.findDetail(999)).rejects.toThrow(
      "会員詳細の取得に失敗しました。status=404"
    );
  });

  it("選択された会員IDをquery parameterとして削除APIへ渡す", async () => {
    const payload = { memberId: 1, memberList: [], ids: [], role: 0 };
    HttpClient.deleteRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(MemberApi.deleteMembers([1, "2"])).resolves.toEqual(payload);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      `${Const.REST_PATH.MEMBER_DELETE}?ids=1&ids=2`
    );
  });

  it("会員登録更新RequestをAPIへ渡す", async () => {
    const request = {
      memberId: 1,
      firstName: "太郎",
      lastName: "山田",
      loginId: "user01",
      email: "user01@example.com",
      password: "password",
      version: 1,
      role: 2,
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(request),
    });

    await MemberApi.upsert(request);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      Const.REST_PATH.MEMBER_UPSERT,
      request
    );
  });
});
