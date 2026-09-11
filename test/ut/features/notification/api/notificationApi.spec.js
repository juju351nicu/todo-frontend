import { beforeEach, describe, expect, it, vi } from "vitest";

import NotificationApi, {
  NotificationApiError,
} from "@/features/notification/api/notificationApi";
import HttpClient from "@/shared/api/httpClient";
import { API_PATHS } from "@/shared/constants/api";

vi.mock("@/shared/api/httpClient", () => ({
  default: {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
  },
}));

describe("Notification API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("認証利用者の通知センターを取得する", async () => {
    const payload = {
      unreadEventCount: 1,
      unresolvedAlertCount: 2,
      badgeCount: 3,
      events: [],
      alerts: [],
      generatedAt: "2026-09-12T00:00:00Z",
    };
    HttpClient.getRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(NotificationApi.getNotificationCenter()).resolves.toEqual(
      payload
    );
    expect(HttpClient.getRequest).toHaveBeenCalledWith(API_PATHS.NOTIFICATIONS);
  });

  it("イベント型通知の一括既読をCSRF対応POSTへ渡す", async () => {
    const payload = { lastReadAt: "2026-09-12T00:00:00Z" };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    });

    await expect(NotificationApi.markEventsRead()).resolves.toEqual(payload);
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      "/api/v1/notifications/events/read",
      null
    );
  });

  it("全体お知らせの件名・本文・表示終了時刻を管理APIへ渡す", async () => {
    const request = {
      title: "保守のお知らせ",
      message: "18時から保守します。",
      expiresAt: "2026-09-13T00:00:00Z",
    };
    const responsePayload = {
      notificationEventId: 1,
      eventType: "ADMIN_ANNOUNCEMENT",
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(responsePayload),
    });

    await expect(NotificationApi.createAnnouncement(request)).resolves.toEqual(
      responsePayload
    );
    expect(HttpClient.postRequest).toHaveBeenCalledWith(
      API_PATHS.ADMINISTRATION_NOTIFICATION_ANNOUNCEMENTS,
      request
    );
  });

  it("Backend項目エラーをstatus付き例外へ保持する", async () => {
    const errorResponse = {
      fieldErrors: [
        {
          errorCode: "VALIDATION_ERROR",
          field: "title",
          message: "件名を入力してください。",
        },
      ],
    };
    HttpClient.postRequest.mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue(errorResponse),
    });

    const promise = NotificationApi.createAnnouncement({
      title: "",
      message: "本文",
      expiresAt: null,
    });

    await expect(promise).rejects.toMatchObject({
      name: "NotificationApiError",
      status: 400,
      errorResponse,
    });
    await promise.catch((error) =>
      expect(error).toBeInstanceOf(NotificationApiError)
    );
  });
});
