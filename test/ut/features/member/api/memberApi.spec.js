import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberApi, { MemberApiError } from "@/features/member/api/memberApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

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
    const payload = { memberList: [] };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(MemberApi.findList()).resolves.toEqual(payload);

    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      API_PATHS.MEMBER_LIST
    );
  });

  it("会員詳細取得のHTTPエラーをstatus付きのMemberApiErrorで通知する", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: false, status: 404 });

    const error = await MemberApi.findDetail(999).catch((caught) => caught);

    expect(error).toBeInstanceOf(MemberApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("会員APIの実行に失敗しました。status=404");
  });

  it("選択された会員IDをquery parameterとして削除APIへ渡す", async () => {
    const payload = { memberList: [] };
    HttpClient.deleteRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(MemberApi.deleteMembers([1, "2"])).resolves.toEqual(payload);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      `${API_PATHS.MEMBER_DELETE}?ids=1&ids=2`
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
      API_PATHS.MEMBER_UPSERT,
      request
    );
  });
});
