import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
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

describe("Project Template API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("本人所有Templateの一覧と詳細を専用pathから取得する", async () => {
    const summaries = [{ projectTemplateId: 81, name: "開発Template" }];
    const detail = { ...summaries[0], memberSlots: [], statuses: [], tasks: [] };
    HttpClient.getRequest
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(summaries),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(detail),
      });

    await expect(ProjectTemplateApi.findOwnTemplates()).resolves.toEqual(
      summaries
    );
    await expect(ProjectTemplateApi.getOwnTemplate(81)).resolves.toEqual(
      detail
    );
    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(
      1,
      API_PATHS.PROJECT_TEMPLATES
    );
    expect(HttpClient.getRequest).toHaveBeenNthCalledWith(
      2,
      "/api/v1/project-templates/81"
    );
  });

  it("ACTIVE Projectを名称と基準日付きでcaptureする", async () => {
    const request = { name: "開発Template", baseDate: "2026-09-21" };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projectTemplateId: 81 }),
    });

    await ProjectTemplateApi.capture(5, request);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/templates",
      request
    );
  });

  it("Template header更新とversion付きarchiveをBackend契約で送信する", async () => {
    const request = { name: "改訂Template", description: "説明", version: 2 };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projectTemplateId: 81, ...request }),
    });
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await ProjectTemplateApi.update(81, request);
    await expect(ProjectTemplateApi.archive(81, 3)).resolves.toBeUndefined();

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/project-templates/81",
      request
    );
    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/project-templates/81?version=3"
    );
  });

  it("member slot mapping付きでTemplateからProjectを生成する", async () => {
    const request = {
      projectKey: "NEW-PROJECT",
      name: "新Project",
      projectStartDate: "2026-10-01",
      memberMappings: [
        { slotKey: "OWNER_1", accountId: 7 },
        { slotKey: "MEMBER_1", accountId: 8 },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ projectId: 99 }),
    });

    await expect(ProjectTemplateApi.apply(81, request)).resolves.toEqual({
      projectId: 99,
    });
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/project-templates/81/projects",
      request
    );
  });

  it("JSON本文のない403をstatus付きProjectTemplateApiErrorへ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    const promise = ProjectTemplateApi.findOwnTemplates();

    await expect(promise).rejects.toMatchObject({
      status: 403,
      errorResponse: null,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(ProjectTemplateApiError)
    );
  });
});
