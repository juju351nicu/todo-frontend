/** Backend APIの接続先。 */
const API_PREFIX_PATH = {
  LOCAL_HOST: "http://localhost:8030",
} as const;

/** data-tableの1ページあたりの既定表示件数。 */
const NUMBER_OF_ITEMS = 5;

/** data-tableで選択できる表示件数。 */
const DATA_TABLE_PAGES = [
  { value: 5, title: "5" },
  { value: 10, title: "10" },
  { value: 20, title: "20" },
  { value: -1, title: "$vuetify.dataFooter.itemsPerPageAll" },
] as const;

/** アラート表示種別。 */
const ALERT_TYPE = {
  SUCCESS: "success",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
} as const;

/** BackendのREST APIパス。 */
const REST_PATH = {
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

export default {
  API_PREFIX_PATH,
  ALERT_TYPE,
  REST_PATH,
  NUMBER_OF_ITEMS,
  DATA_TABLE_PAGES,
};
