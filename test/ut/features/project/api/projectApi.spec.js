import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

describe("Project API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("参照可能なProject一覧を取得する", async () => {
    const projects = [{ projectId: 1, projectKey: "DEMO", name: "Demo" }];
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projects }),
    });

    await expect(ProjectApi.getProjects()).resolves.toEqual(projects);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.PROJECTS);
  });

  it("Project詳細とBoardを別の契約パスから取得する", async () => {
    const detail = { projectId: 7, name: "開発" };
    const board = { projectId: 7, columns: [] };
    HttpClient.getRequest
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(detail),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(board),
      });

    // 参加者が含まれない応答でも、参加者一覧を空配列として補う。
    await expect(ProjectApi.getProject(7)).resolves.toEqual({ ...detail, members: [] });
    await expect(ProjectApi.getTaskBoard(7)).resolves.toEqual(board);

    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(1, "/api/v1/projects/7");
    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects/7/board"
    );
  });

  it.each([
    [401, new SyntaxError("empty")],
    [403, new SyntaxError("not json")],
  ])(
    "本文を解析できない%dをstatus付きProjectApiErrorへ変換する",
    async (status, parseError) => {
      HttpClient.getRequest.mockResolvedValue({
        ok: false,
        status,
        json: vi.fn().mockRejectedValue(parseError),
      });

      const promise = ProjectApi.getProjects();

      await expect(promise).rejects.toMatchObject({
        status,
        errorResponse: null,
      });
      await promise.catch((error) =>
        expect(error).toBeInstanceOf(ProjectApiError)
      );
    }
  );

  it("Project表示情報とarchive状態をPUT契約で更新する", async () => {
    const request = {
      name: "更新Project",
      description: "説明",
      status: "ARCHIVED",
      version: 3,
    };
    const updated = { projectId: 7, ...request, version: 4 };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(updated),
    });

    await expect(ProjectApi.updateProject(7, request)).resolves.toEqual({ ...updated, members: [] });
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7",
      request
    );
  });

  it("参加者に表示名・状態がない応答（Backendの項目追加前）は、IDの表示名とACTIVEを補い、ある値は変えない", async () => {
    const detail = {
      projectId: 7,
      members: [
        { accountId: 3, projectRole: "OWNER" },
        { accountId: 4, projectRole: "MEMBER", displayName: "佐藤 花子", accountStatus: "DISABLED" },
      ],
    };
    HttpClient.getRequest.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(detail) });

    const actual = await ProjectApi.getProject(7);

    expect(actual.members).toEqual([
      { accountId: 3, projectRole: "OWNER", displayName: "アカウントID: 3", accountStatus: "ACTIVE" },
      { accountId: 4, projectRole: "MEMBER", displayName: "佐藤 花子", accountStatus: "DISABLED" },
    ]);
  });

  it("Project memberの追加とrole変更をBackend DTO形式で送信する", async () => {
    const detail = { projectId: 7, members: [] };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(detail),
    });
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(detail),
    });

    await ProjectApi.addProjectMember(7, {
      accountId: 21,
      projectRole: "MEMBER",
    });
    await ProjectApi.updateProjectMember(7, 21, {
      projectRole: "MANAGER",
      version: 2,
    });

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/members",
      { accountId: 21, projectRole: "MEMBER" }
    );
    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/members/21",
      { projectRole: "MANAGER", version: 2 }
    );
  });

  it("Project member除外ではmember versionをquery parameterへ設定して204を本文なしで扱う", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await expect(ProjectApi.removeProjectMember(7, 21, 4)).resolves.toBeUndefined();
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/members/21?version=4"
    );
  });
});
