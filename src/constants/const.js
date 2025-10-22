/**
 * 接続先のURL
 */
const API_PREFIX_PATH = {
  LOCAL_HOST: "http://localhost:8030",
};

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
  MEMBER_LIST: "/api/v1/member/memberList",
  MEMBER_DELETE: "/api/v1/member/deleteMembers",
  MEMBER_UPSERT: "/api/v1/member/upsertConfirm",
  MEMBER_CANCEL: "/api/v1/member/cancel",
  TODO_LIST: "/api/v1/todo/todoList",
  INQUIRY_SEND_MAIL: "/inquiryForm/sendmail",
};
export default {
  API_PREFIX_PATH,
  REST_PATH,
  DATA_TABLE_PAGES
};
