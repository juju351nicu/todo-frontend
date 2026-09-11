import { describe, expect, it } from "vitest";

import {
  formatNotificationBadge,
  getNotificationAlertIcon,
  getNotificationEventIcon,
  normalizeNotificationNavigationPath,
} from "@/features/notification/utils/notification";

describe("notification表示utility", () => {
  it("badge件数を99件で打ち止め表示する", () => {
    expect(formatNotificationBadge(0)).toBe("0");
    expect(formatNotificationBadge(8)).toBe("8");
    expect(formatNotificationBadge(100)).toBe("99+");
  });

  it("Frontend内の絶対pathだけを遷移先として許可する", () => {
    expect(normalizeNotificationNavigationPath("/projects/1/board")).toBe(
      "/projects/1/board"
    );
    expect(normalizeNotificationNavigationPath("https://example.com")).toBeNull();
    expect(normalizeNotificationNavigationPath("//example.com")).toBeNull();
    expect(normalizeNotificationNavigationPath("/\\example.com")).toBeNull();
    expect(normalizeNotificationNavigationPath(null)).toBeNull();
  });

  it("すべての通知種別へ用途を表すMaterial Design iconを割り当てる", () => {
    expect(getNotificationEventIcon("ADMIN_ANNOUNCEMENT")).toBe(
      "mdi-bullhorn-outline"
    );
    expect(getNotificationEventIcon("TASK_ASSIGNED")).toBe(
      "mdi-account-arrow-left-outline"
    );
    expect(getNotificationEventIcon("ATTENDANCE_REJECTED")).toBe(
      "mdi-file-undo-outline"
    );
    expect(getNotificationAlertIcon("TASK_OVERDUE")).toBe(
      "mdi-calendar-alert"
    );
    expect(getNotificationAlertIcon("PUNCH_MISSING")).toBe(
      "mdi-clock-alert-outline"
    );
    expect(getNotificationAlertIcon("APPROVAL_PENDING")).toBe(
      "mdi-file-clock-outline"
    );
  });
});
