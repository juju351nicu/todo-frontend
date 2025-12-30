import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";
export const useUserStore = defineStore("user", {
  state: () => ({
    memberId: 12,
    username: null,
    loginId: null,
    email: null,
    role: -1,
    accessToken: null,
  }),
  getters: {
    /**
     * アクセストークンを取得する
     * @returns アクセストークン
     */
    getAccessToken() {
      return this.accessToken;
    },
    /**
     * 権限情報を取得する
     * @returns 権限情報
     */
    getRole() {
      return this.role;
    },
  },
  actions: {
    /**
     * アクセストークンを削除する
     */
    removeAccessToken() {
      this.accessToken = null;
    },
    /**
     * ユーザー情報を設定する
     * @param {Object} payload ユーザ情報
     */
    setAuthUser(payload) {
      this.memberId = payload.member_id;
      this.username = payload.username;
      this.accessToken = payload.access_token;
      this.role = payload.role;
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
