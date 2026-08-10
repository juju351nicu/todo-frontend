const DEFAULT_API_BASE_URL = "http://localhost:8030";

/** Backend APIの接続先。末尾のスラッシュは除去する。 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

/** BackendのREST APIパス。 */
export const API_PATHS = {
  AUTH_LOGIN: "/api/v1/login",
  SESSION: "/api/v1/session",
  CSRF: "/api/v1/csrf",
  LOGOUT: "/api/v1/logout",
  MEMBER_LIST: "/api/v1/member/memberList",
  MEMBER_DETAIL: "/api/v1/member",
  MEMBER_DELETE: "/api/v1/member/deleteMembers",
  MEMBER_UPSERT: "/api/v1/member/upsertConfirm",
  MEMBER_CANCEL: "/api/v1/member/cancel",
  TODO_LIST: "/api/v1/todo/todoList",
  TODO_DETAIL: "/api/v1/todo",
  TODO_CALENDAR: "/api/v1/todo/calendar",
  TODO_DONE: "/api/v1/todo/doneFlag",
  TODO_UPSERT: "/api/v1/todo/upsertConfirm",
  INQUIRY_SEND_MAIL: "/inquiryForm/sendmail",
} as const;
