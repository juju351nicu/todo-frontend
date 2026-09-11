import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationApiError } from "@/features/notification/api/notificationApi";
import { useAnnouncementManagementPage } from "@/features/notification/composables/useAnnouncementManagementPage";
import { NOTIFICATION_REFRESH_EVENT } from "@/features/notification/composables/useNotificationCenter";

const mocks = vi.hoisted(() => ({
  notificationApi: {
    createAnnouncement: vi.fn(),
  },
  router: { push: vi.fn() },
  userStore: { clearSession: vi.fn() },
  dispatchEvent: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => mocks.router,
  useRoute: () => ({ fullPath: "/administration/notifications" }),
}));
vi.mock("@/features/auth/stores/user", () => ({
  useUserStore: () => mocks.userStore,
}));
vi.mock("@/features/notification/api/notificationApi", async () => {
  const actual = await vi.importActual(
    "@/features/notification/api/notificationApi"
  );
  return { ...actual, default: mocks.notificationApi };
});

describe("useAnnouncementManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.router.push.mockResolvedValue(undefined);
    mocks.notificationApi.createAnnouncement.mockResolvedValue({
      notificationEventId: 1,
    });
    vi.stubGlobal("window", { dispatchEvent: mocks.dispatchEvent });
  });

  it("前後空白を除き表示終了日時をUTCへ変換して全体お知らせを発行する", async () => {
    const page = useAnnouncementManagementPage();
    page.title.value = "  保守のお知らせ  ";
    page.message.value = "  18時から保守します。  ";
    page.expiresAtLocal.value = "2026-09-13T18:00";

    await page.submitAnnouncement();

    expect(mocks.notificationApi.createAnnouncement).toHaveBeenCalledWith({
      title: "保守のお知らせ",
      message: "18時から保守します。",
      expiresAt: new Date("2026-09-13T18:00").toISOString(),
    });
    expect(page.title.value).toBe("");
    expect(page.message.value).toBe("");
    expect(page.successMessage.value).toBe(
      "お知らせを全利用者へ配信しました。"
    );
    expect(mocks.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: NOTIFICATION_REFRESH_EVENT })
    );
  });

  it("件名または本文が空ならAPIを呼ばず入力案内を表示する", async () => {
    const page = useAnnouncementManagementPage();
    page.title.value = "件名";

    await page.submitAnnouncement();

    expect(mocks.notificationApi.createAnnouncement).not.toHaveBeenCalled();
    expect(page.errorMessages.value).toEqual([
      "件名と本文を入力上限内で入力してください。",
    ]);
  });

  it("Backendの項目エラーを画面へ表示する", async () => {
    mocks.notificationApi.createAnnouncement.mockRejectedValue(
      new NotificationApiError(400, {
        fieldErrors: [
          {
            errorCode: "VALIDATION_ERROR",
            field: "expiresAt",
            message: "表示終了時刻は現在より後を指定してください。",
          },
        ],
      })
    );
    const page = useAnnouncementManagementPage();
    page.title.value = "件名";
    page.message.value = "本文";

    await page.submitAnnouncement();

    expect(page.errorMessages.value).toEqual([
      "表示終了時刻は現在より後を指定してください。",
    ]);
  });

  it("401ではSession表示を破棄してログイン画面へ戻す", async () => {
    mocks.notificationApi.createAnnouncement.mockRejectedValue(
      new NotificationApiError(401, null)
    );
    const page = useAnnouncementManagementPage();
    page.title.value = "件名";
    page.message.value = "本文";

    await page.submitAnnouncement();

    expect(mocks.userStore.clearSession).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith({ name: "Login" });
  });
});
