import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";
import Util from "@/utils/util.js";
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
    setAccessToken(token) {
      this.accessToken = token;
    },
    /**
     * ログインする
     */
    authLogin(payload) {
      return Fetcher.postRequest(Const.REST_PATH.AUTH_LOGIN, payload);
    },
    validateToken(_token) {
      return Fetcher.getRequest(Const.REST_PATH.VALIDATE_TOKEN);
    },
  },
  // SessionStorageに保存する場合
  persist: {
    storage: sessionStorage,
  },
});
