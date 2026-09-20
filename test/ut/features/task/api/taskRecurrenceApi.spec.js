import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskRecurrenceApi from "@/features/task/api/taskRecurrenceApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    deleteRequest: vi.fn(),
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
  },
}));

const rule = {
  taskRecurrenceRuleId: 71,
  projectId: 5,
  title: "週次確認",
  version: 3,
};

describe("Task Recurrence API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Project配下のarchive済みを含む規則一覧を取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([rule]),
    });

    await expect(TaskRecurrenceApi.findRules(5)).resolves.toEqual([rule]);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences"
    );
  });

  it("Task snapshotとscheduleを直接作成APIへ送信する", async () => {
    const request = {
      title: "週次確認",
      detail: "確認する",
      priority: 2,
      plannedEffortMinutes: 30,
      dueOffsetDays: 1,
      assigneeAccountId: 7,
      taskStatusId: 11,
      frequency: "WEEKLY",
      intervalCount: 1,
      weekdays: ["MONDAY"],
      monthlyDay: null,
      firstOccurrenceDate: "2026-09-28",
      endDate: null,
      generationLeadDays: 2,
      checklistItems: [{ content: "確認" }],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(rule),
    });

    await TaskRecurrenceApi.create(5, request);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences",
      request
    );
  });

  it("本人所有Template IDとscheduleを専用作成APIへ送信する", async () => {
    const request = {
      taskTemplateId: 81,
      assigneeAccountId: null,
      taskStatusId: 11,
      frequency: "DAILY",
      intervalCount: 1,
      weekdays: [],
      monthlyDay: null,
      firstOccurrenceDate: "2026-09-22",
      endDate: null,
      generationLeadDays: 0,
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(rule),
    });

    await TaskRecurrenceApi.createFromTemplate(5, request);

    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences/from-template",
      request
    );
  });

  it("snapshot・pause状態・楽観ロックversionを更新APIへ送信する", async () => {
    const request = {
      title: "週次確認",
      detail: "更新",
      priority: 2,
      plannedEffortMinutes: 30,
      dueOffsetDays: 1,
      assigneeAccountId: 7,
      taskStatusId: 11,
      frequency: "DAILY",
      intervalCount: 2,
      weekdays: [],
      monthlyDay: null,
      endDate: null,
      generationLeadDays: 0,
      status: "PAUSED",
      checklistItems: [],
      version: 3,
    };
    HttpClient.putRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ...rule, version: 4 }),
    });

    await TaskRecurrenceApi.update(5, 71, request);

    expect(HttpClient.putRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences/71",
      request
    );
  });

  it("取得時点versionをqueryへ指定して規則をarchiveする", async () => {
    HttpClient.deleteRequest.mockResolvedValue({ ok: true, status: 204 });

    await TaskRecurrenceApi.archive(5, 71, 3);

    expect(HttpClient.deleteRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences/71?version=3"
    );
  });

  it("規則の生成履歴を取得する", async () => {
    const generations = [{ taskRecurrenceGenerationId: 91, status: "FAILED" }];
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(generations),
    });

    await expect(TaskRecurrenceApi.findGenerations(5, 71)).resolves.toEqual(
      generations
    );
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences/71/generations"
    );
  });

  it("FAILED生成履歴へ規則versionを指定して再試行する", async () => {
    const generation = { taskRecurrenceGenerationId: 91, status: "PENDING" };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(generation),
    });

    await expect(
      TaskRecurrenceApi.retryGeneration(5, 71, 91, 3)
    ).resolves.toEqual(generation);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/5/task-recurrences/71/generations/91/retry",
      { version: 3 }
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
      TaskRecurrenceApi.retryGeneration(5, 71, 91, 3)
    ).rejects.toMatchObject({ status: 403, errorResponse });
  });
});
