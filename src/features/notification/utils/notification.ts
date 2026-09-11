import type {
  NotificationAlertType,
  NotificationEventType,
} from "@/features/notification/types/notification";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** ベルbadgeで3桁以上を占有しない表示へ件数を変換する。 */
export const formatNotificationBadge = (count: number): string =>
  count > 99 ? "99+" : String(Math.max(0, count));

/**
 * Backendが返した遷移先をVue Router内の絶対pathだけに制限する。
 * protocol-relative URL、backslash、相対pathは外部誘導を避けるため無効にする。
 */
export const normalizeNotificationNavigationPath = (
  path: string | null | undefined
): string | null => {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return null;
  }
  return path;
};

/** ISO通知時刻を利用者端末の日本語月日・時分へ変換する。 */
export const formatNotificationOccurredAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "時刻不明" : DATE_TIME_FORMATTER.format(date);
};

/** イベント種別に対応するMaterial Design iconを返す。 */
export const getNotificationEventIcon = (type: NotificationEventType): string => {
  const icons: Record<NotificationEventType, string> = {
    ADMIN_ANNOUNCEMENT: "mdi-bullhorn-outline",
    TASK_ASSIGNED: "mdi-account-arrow-left-outline",
    ATTENDANCE_REJECTED: "mdi-file-undo-outline",
  };
  return icons[type];
};

/** 導出警告種別に対応するMaterial Design iconを返す。 */
export const getNotificationAlertIcon = (type: NotificationAlertType): string => {
  const icons: Record<NotificationAlertType, string> = {
    TASK_OVERDUE: "mdi-calendar-alert",
    PUNCH_MISSING: "mdi-clock-alert-outline",
    APPROVAL_PENDING: "mdi-file-clock-outline",
  };
  return icons[type];
};
