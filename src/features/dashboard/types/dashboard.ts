import type { AttendanceMonthStatus } from "@/features/attendance/types/attendance";
import type { NotificationEventType } from "@/features/notification/types/notification";
import type {
  ProjectRole,
  TaskPriority,
} from "@/features/project/types/project";
import type { MyTaskDueGroup } from "@/features/task/types/task";

/** DashboardのMy Tasks previewへ表示する本人担当Task。 */
export interface DashboardTask {
  taskId: number;
  projectId: number;
  projectKey: string;
  projectName: string;
  taskStatusId: number;
  statusName: string;
  title: string;
  dueDate: string;
  dueGroup: MyTaskDueGroup;
  remainingDays: number;
  priority: TaskPriority;
  progressPercent: number;
}

/** TASK_READ境界を含む本人担当Taskの期限別集計。 */
export interface DashboardMyTasks {
  available: boolean;
  totalCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  upcomingCount: number;
  items: DashboardTask[];
}

/** Dashboardへ表示する保存済み通知イベントの概要。 */
export interface DashboardNotificationEvent {
  notificationEventId: number;
  eventType: NotificationEventType;
  title: string;
  message: string;
  navigationPath: string | null;
  occurredAt: string;
  publisherDisplayName: string;
  read: boolean;
}

/** 全認証利用者へ返す通知件数と直近イベント。 */
export interface DashboardNotifications {
  available: boolean;
  unreadEventCount: number;
  unresolvedAlertCount: number;
  badgeCount: number;
  recentEvents: DashboardNotificationEvent[];
}

/** Dashboardへ表示するACTIVE Projectの進捗概要。 */
export interface DashboardProject {
  projectId: number;
  projectKey: string;
  projectName: string;
  projectRole: ProjectRole | null;
  totalTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  averageProgressPercent: number;
}

/** PROJECT_READとTASK_READ境界を含むProject進捗集計。 */
export interface DashboardProjects {
  available: boolean;
  activeProjectCount: number;
  cards: DashboardProject[];
}

/** ATTENDANCE_READ_OWN境界を含む本人の当月勤怠概要。 */
export interface DashboardAttendance {
  available: boolean;
  yearMonth: string | null;
  status: AttendanceMonthStatus | null;
  grossWorkMinutes: number | null;
  breakMinutes: number | null;
  netWorkMinutes: number | null;
  hasIncompletePeriod: boolean | null;
}

/** GET /api/v1/dashboard/basicが返す同一基準時刻の基本Dashboard。 */
export interface BasicDashboardResponse {
  generatedAt: string;
  businessDate: string;
  businessZoneId: string;
  myTasks: DashboardMyTasks;
  notifications: DashboardNotifications;
  projects: DashboardProjects;
  attendance: DashboardAttendance;
}
