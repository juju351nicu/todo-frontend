import { resolve } from "node:path";

/** Dashboard専用accountのSession Cookieを保存するGit管理外path。 */
export const DASHBOARD_AUTH_STATE_PATH = resolve(
  "playwright/.auth/dashboard-browser.json"
);

/** My Tasks主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const MY_TASKS_AUTH_STATE_PATH = resolve(
  "playwright/.auth/my-tasks-browser.json"
);

/** Board主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const BOARD_AUTH_STATE_PATH = resolve(
  "playwright/.auth/board-browser.json"
);

/** Project Template主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const PROJECT_TEMPLATE_AUTH_STATE_PATH = resolve(
  "playwright/.auth/project-template-owner.json"
);

/** 繰り返しTask主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const TASK_RECURRENCE_AUTH_STATE_PATH = resolve(
  "playwright/.auth/recurrence-owner.json"
);

/** 権限変更journeyの管理者Session Cookieを保存するGit管理外path。 */
export const AUTHORIZATION_ADMIN_AUTH_STATE_PATH = resolve(
  "playwright/.auth/authorization-admin-browser.json"
);

/** 権限変更journeyの変更対象者Session Cookieを保存するGit管理外path。 */
export const AUTHORIZATION_TARGET_AUTH_STATE_PATH = resolve(
  "playwright/.auth/authorization-target-browser.json"
);

/** 勤怠月次workflowの本人Session Cookieを保存するGit管理外path。 */
export const ATTENDANCE_MONTH_EMPLOYEE_AUTH_STATE_PATH = resolve(
  "playwright/.auth/attendance-month-browser.json"
);

/** 勤怠月次workflowの確認者Session Cookieを保存するGit管理外path。 */
export const ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH = resolve(
  "playwright/.auth/attendance-month-reviewer.json"
);

/** 勤怠月次workflowの締め担当Session Cookieを保存するGit管理外path。 */
export const ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH = resolve(
  "playwright/.auth/attendance-month-closer.json"
);

/** setupとteardownで同時に管理する全認証状態path。 */
export const AUTH_STATE_PATHS = [
  DASHBOARD_AUTH_STATE_PATH,
  MY_TASKS_AUTH_STATE_PATH,
  BOARD_AUTH_STATE_PATH,
  PROJECT_TEMPLATE_AUTH_STATE_PATH,
  TASK_RECURRENCE_AUTH_STATE_PATH,
  AUTHORIZATION_ADMIN_AUTH_STATE_PATH,
  AUTHORIZATION_TARGET_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_EMPLOYEE_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH,
] as const;

/** Playwrightから参照するBackend repositoryのpath。CIではcheckout先を環境変数で指定する。 */
export const BACKEND_PATH = resolve(
  process.env.E2E_BACKEND_PATH ?? "../todo-backend"
);
