import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";
export const useUserStore = defineStore("user", {
  state: () => ({
    memberId: 12,
    lastName: "",
    firstName: "",
    loginId: "",
    password: "",
    email: "",
    role: "",
    version: "",
    accessToken: "",
  }),
  getters: {},
  actions: {
    /**
     * アクセストークンチェックを設定する
     * @param {String} token トークン文字列
     */
    setAccessToken(token) {
      this.accessToken = token;
    },
    /**
     * ログインする
     * @param {Object} payload リクエスト情報
     * @returns ログイン結果
     */
    authLogin(payload) {
      return Fetcher.postRequest(Const.REST_PATH.AUTH_LOGIN, payload);
    },
    /**
     * トークンチェックを行う
     * @param {String} _token トークン文字列
     * @returns トークン判定結果
     */
    validateToken(_token) {
      return Fetcher.getRequest(Const.REST_PATH.VALIDATE_TOKEN);
    },
  },
  // SessionStorageに保存する場合
  persist: {
    storage: sessionStorage,
  },
});
