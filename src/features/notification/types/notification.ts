/** Backendに保存され、利用者ごとの既読位置で管理する通知種別。 */
export type NotificationEventType =
  | "ADMIN_ANNOUNCEMENT"
  | "TASK_ASSIGNED"
  | "ATTENDANCE_REJECTED";

/** 現在の業務状態から毎回導出し、元の状態を解消すると消える警告種別。 */
export type NotificationAlertType =
  | "TASK_OVERDUE"
  | "PUNCH_MISSING"
  | "APPROVAL_PENDING";

/** ベル一覧へ表示する保存済みイベント型通知。 */
export interface NotificationEvent {
  notificationEventId: number;
  eventType: NotificationEventType;
  title: string;
  message: string;
  navigationPath: string | null;
  occurredAt: string;
  publisherDisplayName: string;
  read: boolean;
}

/** ベル一覧へ表示する未解決の導出型警告。 */
export interface NotificationAlert {
  alertKey: string;
  alertType: NotificationAlertType;
  title: string;
  message: string;
  navigationPath: string;
  referenceDate: string;
}

/** 通知センターAPIが返す現在スナップショット。 */
export interface NotificationCenterResponse {
  unreadEventCount: number;
  unresolvedAlertCount: number;
  badgeCount: number;
  events: NotificationEvent[];
  alerts: NotificationAlert[];
  generatedAt: string;
}

/** イベント型通知の一括既読結果。 */
export interface NotificationReadResponse {
  lastReadAt: string;
}

/** システム管理者が全利用者向けお知らせを発行する入力。 */
export interface AnnouncementCreateRequest {
  title: string;
  message: string;
  expiresAt: string | null;
}
