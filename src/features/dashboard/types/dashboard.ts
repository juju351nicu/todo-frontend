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

/** 高度Dashboardへ表示するProject単位のEVMと本人週次予定負荷summary。 */
export interface AdvancedDashboardProject {
  /** 既存Board・WBSへ遷移するProject ID。 */
  projectId: number;
  /** 変更不可のProjectキー。 */
  projectKey: string;
  /** Project表示名。 */
  projectName: string;
  /** 計算に使用したactive baseline ID。 */
  baselineId: number;
  /** Project内のbaseline表示用連番。 */
  baselineNumber: number;
  /** active baseline表示名。 */
  baselineName: string;
  /** active baseline作成日。yyyy-MM-dd形式。 */
  baselineDate: string;
  /** EVMと本人週次負荷の基準日。yyyy-MM-dd形式。 */
  statusDate: string;
  /** EVM価値単位。初期契約では常に分。 */
  valueUnit: "MINUTES";
  /** BAC（分）。 */
  bac: number;
  /** PV（分）。 */
  pv: number;
  /** Backendが小数第2位へ丸めたEV（分）。 */
  ev: number;
  /** AC（分）。 */
  ac: number;
  /** Backendが小数第2位へ丸めたSV（分）。 */
  sv: number;
  /** Backendが小数第2位へ丸めたCV（分）。 */
  cv: number;
  /** PVが0の場合はnull。 */
  spi: number | null;
  /** ACが0の場合はnull。 */
  cpi: number | null;
  /** BACが0の場合はnull。 */
  plannedProgressPercent: number | null;
  /** BACが0の場合はnull。 */
  earnedProgressPercent: number | null;
  /** BACからbaseline日別配賦工数を引いた差（分）。 */
  baselineAllocationVarianceMinutes: number;
  /** baseline外TaskからACへ算入しなかった実績工数（分）。 */
  excludedActualEffortMinutes: number;
  /** Backendが返す安定したEVM警告code。警告なしでは空配列。 */
  warningCodes: string[];
  /** 本人予定負荷を集計した週の月曜日。 */
  workloadWeekStartDate: string;
  /** 本人予定負荷を集計した週の日曜日。 */
  workloadWeekEndDate: string;
  /** 集計週における本人予定工数合計（分）。 */
  ownPlannedWorkloadMinutes: number;
  /** 本人予定工数が日別480分を超えた日数。 */
  ownOverEightHourDayCount: number;
}

/** GET /api/v1/dashboard/advancedが返すProject横断EVM・本人負荷summary。 */
export interface AdvancedDashboardResponse {
  /** 全Projectへ適用したEVM・本人負荷の基準日。 */
  statusDate: string;
  /** 日付境界の判定に使用したIANA time zone ID。 */
  businessZoneId: string;
  /** 参照可能なACTIVE Projectのうちactive baselineを持たない件数。 */
  projectsWithoutActiveBaselineCount: number;
  /** active baselineを持つProjectの比較用summary。最大10件。 */
  projects: AdvancedDashboardProject[];
}
