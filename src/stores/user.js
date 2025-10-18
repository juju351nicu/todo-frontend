import { defineStore } from "pinia";

export const useUserStore = defineStore("user", {
  state: () => ({
    memberId: 0,
    lastName: "",
    firstName: "",
    loginId: "",
    password: "",
    email: "",
    role: "",
    version: "",
  }),
  getters: {},
  actions: {},
  // SessionStorageに保存する場合
  persist: {
    storage: sessionStorage,
  },
});
