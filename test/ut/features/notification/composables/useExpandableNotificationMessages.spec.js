import { describe, expect, it, vi } from "vitest";

import { useExpandableNotificationMessages } from "@/features/notification/composables/useExpandableNotificationMessages";

/** 遷移先のない管理者お知らせ。 */
const announcement = { notificationEventId: 1, navigationPath: null };
/** 遷移先のあるTask割当通知。 */
const taskAssigned = { notificationEventId: 2, navigationPath: "/projects/7/board" };

describe("useExpandableNotificationMessages", () => {
  it("遷移先のない通知だけを本文の開閉対象にする（安全でないpathも遷移できないので開閉対象）", () => {
    const { canExpandNotification } = useExpandableNotificationMessages();

    expect(canExpandNotification(announcement)).toBe(true);
    expect(canExpandNotification(taskAssigned)).toBe(false);
    expect(
      canExpandNotification({ notificationEventId: 3, navigationPath: "https://example.com" })
    ).toBe(true);
  });

  it("遷移先がなければ押すたびに全文表示を切り替え、遷移処理は呼ばない", async () => {
    const { isNotificationExpanded, openOrToggleNotification } =
      useExpandableNotificationMessages();
    const navigate = vi.fn(async () => {});

    await openOrToggleNotification(announcement, navigate);
    expect(isNotificationExpanded(1)).toBe(true);
    await openOrToggleNotification(announcement, navigate);
    expect(isNotificationExpanded(1)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("遷移先があれば遷移し、全文表示の状態は変えない", async () => {
    const { isNotificationExpanded, openOrToggleNotification } =
      useExpandableNotificationMessages();
    const navigate = vi.fn(async () => {});

    await openOrToggleNotification(taskAssigned, navigate);

    expect(navigate).toHaveBeenCalledWith("/projects/7/board");
    expect(isNotificationExpanded(2)).toBe(false);
  });

  it("複数の通知の開閉状態をそれぞれ保つ", () => {
    const { isNotificationExpanded, toggleNotificationExpanded } =
      useExpandableNotificationMessages();

    toggleNotificationExpanded(1);
    toggleNotificationExpanded(5);
    toggleNotificationExpanded(1);

    expect(isNotificationExpanded(1)).toBe(false);
    expect(isNotificationExpanded(5)).toBe(true);
  });
});
