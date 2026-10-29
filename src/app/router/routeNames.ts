/**
 * 画面（route）の名前。route定義（`routes.ts`）、`router.push({ name })`、`RouterLink`の`to`で同じ定数を使い、
 * 名前の書き間違いを型検査で見つけられるようにする。値はURLに出ない内部の識別子で、
 * 既存のE2E・Vitestが文字列で照合しているため変えない。
 */
export const ROUTE_NAMES = {
  login: "Login",
  dashboard: "Dashboard",
  attendance: "Attendance",
  attendanceAdministration: "AttendanceAdministration",
  accountAdministration: "AccountAdministration",
  authorizationAuditList: "AuthorizationAuditList",
  notificationAdministration: "NotificationAdministration",
  memberList: "MemberList",
  memberDetail: "MemberDetail",
  memberCancel: "MemberCancel",
  projectList: "ProjectList",
  projectTemplates: "ProjectTemplates",
  myTasks: "MyTasks",
  taskSearch: "TaskSearch",
  taskBoard: "TaskBoard",
  wbs: "Wbs",
  taskCalendar: "TaskCalendar",
  taskList: "TaskList",
  taskListDetail: "TaskListDetail",
  taskRegister: "TaskRegister",
  accessDenied: "AccessDenied",
  inquiryForm: "InquiryForm",
  notFound: "NotFound",
} as const;

/** `ROUTE_NAMES`のいずれかの画面名。 */
export type RouteName = (typeof ROUTE_NAMES)[keyof typeof ROUTE_NAMES];
