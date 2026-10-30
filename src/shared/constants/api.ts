const DEFAULT_API_BASE_URL = "http://localhost:8030";

/** Backend APIの接続先。末尾のスラッシュは除去する。 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  ""
);

/** BackendのREST APIパス。 */
export const API_PATHS = {
  AUTH_LOGIN: "/api/v1/login",
  SESSION: "/api/v1/session",
  CSRF: "/api/v1/csrf",
  LOGOUT: "/api/v1/logout",
  DASHBOARD_BASIC: "/api/v1/dashboard/basic",
  DASHBOARD_ADVANCED: "/api/v1/dashboard/advanced",
  ACCOUNTS: "/api/v1/accounts",
  PROJECTS: "/api/v1/projects",
  PROJECT_TEMPLATES: "/api/v1/project-templates",
  MY_TASKS: "/api/v1/my-tasks",
  TASK_SEARCH: "/api/v1/tasks/search",
  TASK_SEARCH_OPTIONS: "/api/v1/tasks/search/options",
  TASK_SAVED_VIEWS: "/api/v1/task-saved-views",
  TASK_TEMPLATES: "/api/v1/task-templates",
  TIME_TRACKING_CURRENT: "/api/v1/time-tracking/current",
  TIME_TRACKING_SESSIONS: "/api/v1/time-tracking/sessions",
  TASK_LIST_SEARCH: "/api/v1/task-list/search",
  TASK_LIST_DETAIL: "/api/v1/task-list",
  TASK_LIST_CALENDAR: "/api/v1/task-list/calendar",
  TASK_LIST_DONE: "/api/v1/task-list/done",
  TASK_LIST_UPSERT: "/api/v1/task-list/upsert",
  INQUIRY_SEND_MAIL: "/inquiryForm/sendmail",
  ADMINISTRATION_ACCOUNTS: "/api/v1/administration/accounts",
  ADMINISTRATION_ROLES: "/api/v1/administration/roles",
  AUTHORIZATION_AUDIT_LOGS: "/api/v1/administration/authorization-audit-logs",
  ATTENDANCE: "/api/v1/attendance",
  NOTIFICATIONS: "/api/v1/notifications",
  ADMINISTRATION_NOTIFICATION_ANNOUNCEMENTS: "/api/v1/administration/notifications/announcements",
} as const;
