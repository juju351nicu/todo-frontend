/**
 * 接続先のURL
 */
const API_PREFIX_PATH = {
  LOCAL_HOST: "http://localhost:8030",
};
/** data-tableの1ページあたりの表示件数（デフォルト）*/
const NUMBER_OF_ITEMS = 5;
/** data-tableの表示件数の選択リスト */
const DATA_TABLE_PAGES = [
  { value: 5, title: "5" },
  { value: 10, title: "10" },
  { value: 20, title: "20" },
  { value: -1, title: "$vuetify.dataFooter.itemsPerPageAll" },
];
/**
 * REST通信用のURL
 */
const REST_PATH = {
  AUTH_LOGIN: "/api/v1/login",
  VALIDATE_TOKEN: "/api/v1/tokenValidate",
  MEMBER_LIST: "/api/v1/member/memberList",
  MEMBER_DELETE: "/api/v1/member/deleteMembers",
  MEMBER_UPSERT: "/api/v1/member/upsertConfirm",
  MEMBER_CANCEL: "/api/v1/member/cancel",
  TODO_LIST: "/api/v1/todo/todoList",
  TODO_CALENDAR: "/api/v1/todo/calendar",
  TODO_UPSERT: "/api/v1/todo/upsertConfirm",
  INQUIRY_SEND_MAIL: "/inquiryForm/sendmail",
};
export default {
  API_PREFIX_PATH,
  REST_PATH,
  NUMBER_OF_ITEMS,
  DATA_TABLE_PAGES,
};
