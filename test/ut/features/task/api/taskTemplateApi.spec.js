import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskTemplateApi from "@/features/task/api/taskTemplateApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

const template = {
  taskTemplateId: 81,
  name: "API実装",
  title: "APIを実装する",
  detail: "Controllerからテストまで実装する",
  priority: 3,
  dueOffsetDays: 2,
  plannedEffortMinutes: 480,
  defaultStatusCode: "TODO",
  defaultAssigneeAccountId: 7,
  sourceProjectId: 5,
  sourceTaskId: 31,
  checklistItems: [{ content: "テストを追加", position: 1000 }],
  createdAt: "2026-09-21T01:00:00Z",
  updatedAt: "2026-09-21T01:00:00Z",
  version: 0,
};

describe("Task Template API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("本人所有のactive Template一覧を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([template]),
    });

    await expect(TaskTemplateApi.findOwnTemplates()).resolves.toEqual([
      template,
    ]);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/task-templates"
    );
  });

  it("既存Taskを名称付きでTemplateへcaptureする", async () => {
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(template),
    });

    await TaskTemplateApi.capture(5, 31, { name: "API実装" });

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/31/templates",
      { name: "API実装" }
    );
  });

  it("Template snapshotとversionを更新APIへ送信する", async () => {
    const request = {
      name: "API実装",
      title: "APIを実装する",
      detail: "更新",
      priority: 3,
      dueOffsetDays: 3,
      plannedEffortMinutes: 600,
      defaultStatusCode: "TODO",
      defaultAssigneeAccountId: null,
      checklistItems: [{ content: "テスト" }],
      version: 0,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ...template, ...request, version: 1 }),
    });

    await TaskTemplateApi.update(81, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/task-templates/81",
      request
    );
  });

  it("取得時点versionをqueryへ指定してTemplateをarchiveする", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await TaskTemplateApi.archive(81, 2);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/task-templates/81?version=2"
    );
  });

  it("Template IDと任意上書き値をProject適用APIへ送信する", async () => {
    const request = {
      taskTemplateId: 81,
      dateFrom: "2026-09-21",
      assigneeAccountId: null,
      taskStatusId: 11,
    };
    const task = { taskId: 91, projectId: 5 };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(task),
    });

    await expect(TaskTemplateApi.apply(5, request)).resolves.toEqual(task);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/tasks/from-template",
      request
    );
  });

  it("403の機能資格エラー本文を例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          field: "featureCode",
          errorCode: "FEATURE_NOT_ENTITLED",
          message: "現在のPlanでは利用できません。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    await expect(
      TaskTemplateApi.capture(5, 31, { name: "API実装" })
    ).rejects.toMatchObject({ status: 403, errorResponse });
  });
});
