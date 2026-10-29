import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationCenter } from "@/features/notification/composables/useNotificationCenter";

const mocks = vi.hoisted(() => ({
  notificationApi: { getNotificationCenter: vi.fn(), markEventsRead: vi.fn() },
  router: { push: vi.fn() },
  userStore: { isAuthenticated: true, clearSession: vi.fn() },
}));

vi.mock("vue-router", async () => {
  const { reactive: createReactive } = await import("vue");
  const route = createReactive({ fullPath: "/dashboard" });
  return { useRoute: () => route, useRouter: () => mocks.router };
});
vi.mock("@/features/auth/stores/user", () => ({ useUserStore: () => mocks.userStore }));
vi.mock("@/features/notification/api/notificationApi", async () => {
  const actual = await vi.importActual("@/features/notification/api/notificationApi");
  return { ...actual, default: mocks.notificationApi };
});

/** 未読のお知らせ1件（遷移先なし）と既読のTask割当1件を持つ通知センター。 */
const buildCenter = () => ({
  unreadEventCount: 1,
  unresolvedAlertCount: 0,
  badgeCount: 1,
  alerts: [],
  events: [
    {
      notificationEventId: 2,
      eventType: "ADMIN_ANNOUNCEMENT",
      title: "お知らせ",
      message: "1\n2\n3",
      navigationPath: null,
      occurredAt: "2026-10-26T13:00:00Z",
      publisherDisplayName: "管理者",
      read: false,
    },
    {
      notificationEventId: 1,
      eventType: "TASK_ASSIGNED",
      title: "割当",
      message: "Task",
      navigationPath: "/projects/7/board",
      occurredAt: "2026-10-26T12:00:00Z",
      publisherDisplayName: "管理者",
      read: true,
    },
  ],
  generatedAt: "2026-10-26T13:00:01Z",
});

describe("useNotificationCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationApi.getNotificationCenter.mockResolvedValue(buildCenter());
    mocks.notificationApi.markEventsRead.mockResolvedValue({ lastReadAt: "2026-10-26T13:00:02Z" });
  });

  it("開いた時にBackendで既読にしてbadgeを減らすが、一覧の未読の印は閉じるまで残す", async () => {
    const center = useNotificationCenter();

    await center.handleMenuVisibility(true);

    expect(mocks.notificationApi.markEventsRead).toHaveBeenCalledOnce();
    expect(center.badgeCount.value).toBe(0);
    expect(center.unreadEventCount.value).toBe(0);
    // 開いた直後に印を外すと、どれが新着か見分けられないまま消えてしまう。
    expect(center.events.value.map((event) => event.read)).toEqual([false, true]);

    await center.handleMenuVisibility(false);

    expect(center.events.value.every((event) => event.read)).toBe(true);
  });

  it("未読がなければ既読APIを呼ばない", async () => {
    mocks.notificationApi.getNotificationCenter.mockResolvedValue({
      ...buildCenter(),
      unreadEventCount: 0,
      badgeCount: 0,
    });
    const center = useNotificationCenter();

    await center.handleMenuVisibility(true);

    expect(mocks.notificationApi.markEventsRead).not.toHaveBeenCalled();
  });

  it("遷移先のないお知らせは押すと全文表示を切り替え、メニューを閉じない", async () => {
    const center = useNotificationCenter();
    await center.handleMenuVisibility(true);
    const [announcement, taskAssigned] = center.events.value;

    await center.openNotificationEvent(announcement);

    expect(center.isNotificationExpanded(announcement.notificationEventId)).toBe(true);
    expect(center.isMenuOpen.value).toBe(true);
    expect(mocks.router.push).not.toHaveBeenCalled();

    await center.openNotificationEvent(taskAssigned);

    expect(center.isMenuOpen.value).toBe(false);
    expect(mocks.router.push).toHaveBeenCalledWith("/projects/7/board");
  });
});
