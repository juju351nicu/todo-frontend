import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: { getRequest: vi.fn() },
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

    await expect(ProjectApi.getProject(7)).resolves.toEqual(detail);
    await expect(ProjectApi.getTaskBoard(7)).resolves.toEqual(board);

    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(1, "/api/v1/projects/7");
    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(
      2,
      "/api/v1/projects/7/board"
    );
  });

  it("JSON本文のない403をstatus付きProjectApiErrorへ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    const promise = ProjectApi.getProjects();

    await expect(promise).rejects.toMatchObject({
      status: 403,
      errorResponse: null,
    });
    await promise.catch((error) => expect(error).toBeInstanceOf(ProjectApiError));
  });
});
