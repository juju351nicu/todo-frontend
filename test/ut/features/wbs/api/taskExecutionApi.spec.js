import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getExecutionComparison,
  recordExecutionSetting,
} from "@/features/wbs/api/taskExecutionApi";
import { WbsApiError } from "@/features/wbs/api/wbsApi";
import HttpClient from "@/shared/api/httpClient";

vi.mock("@/shared/api/httpClient", () => ({
  default: { getRequest: vi.fn(), postRequest: vi.fn() },
}));

describe("設定別実績API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("Taskと期間を限定して参照し、欠けた履歴は空配列へ揃える", async () => {
    HttpClient.getRequest.mockResolvedValue({ ok: true, json: async () => ({ taskId: 2 }) });
    await expect(getExecutionComparison(7, 2, "2026-11-01", "2026-11-23")).resolves.toEqual({
      taskId: 2,
      groups: [],
      days: [],
      sessions: [],
      measurements: [],
    });
    expect(HttpClient.getRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/2/execution-comparison?dateFrom=2026-11-01&dateTo=2026-11-23"
    );
    expect(HttpClient.postRequest).not.toHaveBeenCalled();
  });
  it("申告した設定だけを共通CSRF clientへ渡し、受理時刻を維持する", async () => {
    const request = {
      timerSessionId: 12,
      assistanceMode: "NONE",
      progressMeasurementId: null,
      agentName: null,
      modelIdentifier: null,
      reasoningEffort: null,
      serviceTier: null,
    };
    const saved = { ...request, recordedAt: "2026-11-23T01:00:00Z" };
    HttpClient.postRequest.mockResolvedValue({ ok: true, json: async () => saved });
    await expect(recordExecutionSetting(7, 2, request)).resolves.toEqual(saved);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/projects/7/wbs/tasks/2/execution-settings",
      request
    );
  });
  it.each([401, 403, 404, 409, 400])("HTTP %iを既存WBSのerror契約へ変換する", async (status) => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status,
      json: async () => ({ message: "private" }),
    });
    await expect(getExecutionComparison(7, 2, "2026-11-01", "2026-11-23")).rejects.toBeInstanceOf(
      WbsApiError
    );
  });
});
