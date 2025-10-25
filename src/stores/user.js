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
  }),
  getters: {},
  actions: {
    /**
     * ログインする
     */
    authLogin(payload) {
      this.isLoading = true;
      Fetcher.postRequest(Const.REST_PATH.AUTH_LOGIN, payload)
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then((data) => {
          console.log(data);
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
  },
  // SessionStorageに保存する場合
  persist: {
    storage: sessionStorage,
  },
});
