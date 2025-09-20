/**
 * 接続先のURL
 */
const API_PREFIX_PATH = {
  LOCAL_HOST: "http://localhost:8030",
};

/**
 * REST通信用のURL
 */
const REST_PATH = {
  MEMBER_LIST: "/api/v1/member/memberList",
  MEMBER_DELETE: "/api/v1/member/deleteMembers",
  INQUIRY_SEND_MAIL: "/inquiryForm/sendmail",
};
export default {
  API_PREFIX_PATH,
  REST_PATH,
};
