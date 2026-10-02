import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardApi, {
  DashboardApiError,
} from "@/features/dashboard/api/dashboardApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
  },
}));

const response = {
  generatedAt: "2026-09-21T00:00:00Z",
  businessDate: "2026-09-21",
  businessZoneId: "Asia/Tokyo",
  myTasks: { available: true, totalCount: 0, items: [] },
  notifications: { available: true, badgeCount: 0, recentEvents: [] },
  projects: { available: true, activeProjectCount: 0, cards: [] },
  attendance: { available: false, yearMonth: null, status: null },
};

describe("Dashboard API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Session利用者のBasic Dashboardを専用GETから取得する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(response),
    });

    await expect(DashboardApi.getBasicDashboard()).resolves.toEqual(response);
    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.DASHBOARD_BASIC);
  });

  it("一覧項目が欠落したResponseを画面境界で空配列へ正規化する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ...response,
        myTasks: { ...response.myTasks, items: undefined },
        notifications: {
          ...response.notifications,
          recentEvents: undefined,
        },
        projects: { ...response.projects, cards: undefined },
      }),
    });

    await expect(DashboardApi.getBasicDashboard()).resolves.toMatchObject({
      myTasks: { items: [] },
      notifications: { recentEvents: [] },
      projects: { cards: [] },
    });
  });

  it("JSON本文のない401をstatus付きDashboardApiErrorへ変換する", async () => {
    HttpClient.getRequest.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockRejectedValue(new SyntaxError("empty")),
    });

    const promise = DashboardApi.getBasicDashboard();

    await expect(promise).rejects.toMatchObject({
      status: 401,
      errorResponse: null,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(DashboardApiError)
    );
  });
});
