import { defineStore } from "pinia";

import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";

export const useUserStore = defineStore("user", {
  state: () => ({
    memberId: null,
    username: null,
    displayName: null,
    roleCodes: [],
    permissionCodes: [],
    authenticated: false,
    sessionChecked: false,
  }),
  getters: {
    getRole() {
      if (this.roleCodes.includes("SYSTEM_ADMIN")) {
        return 0;
      }
      if (this.roleCodes.includes("READ_ONLY_ADMIN")) {
        return 1;
      }
      return 2;
    },
    isAuthenticated() {
      return this.authenticated;
    },
    hasRole() {
      return (roleCode) => this.roleCodes.includes(roleCode);
    },
  },
  actions: {
    setSessionUser(payload) {
      this.memberId = payload.accountId;
      this.username = payload.username;
      this.displayName = payload.displayName;
      this.roleCodes = [...(payload.roleCodes ?? [])];
      this.permissionCodes = [...(payload.permissionCodes ?? [])];
      this.authenticated = true;
      this.sessionChecked = true;
    },
    clearSession() {
      this.memberId = null;
      this.username = null;
      this.displayName = null;
      this.roleCodes = [];
      this.permissionCodes = [];
      this.authenticated = false;
    },
    async restoreSession(force = false) {
      if (this.sessionChecked && !force) {
        return this.authenticated;
      }
      try {
        const response = await Fetcher.getRequest(Const.REST_PATH.SESSION);
        if (!response.ok) {
          this.clearSession();
          return false;
        }
        this.setSessionUser(await response.json());
        return true;
      } catch (_error) {
        this.clearSession();
        return false;
      } finally {
        this.sessionChecked = true;
      }
    },
    async authLogin(payload) {
      const response = await Fetcher.postRequest(Const.REST_PATH.AUTH_LOGIN, payload);
      if (response.ok) {
        await Fetcher.refreshCsrfToken();
        await this.restoreSession(true);
      }
      return response;
    },
    async logout() {
      try {
        const response = await Fetcher.postRequest(Const.REST_PATH.LOGOUT, null);
        if (!response.ok) {
          throw new Error(`ログアウトに失敗しました。status=${response.status}`);
        }
        Fetcher.clearCsrfToken();
        await Fetcher.refreshCsrfToken();
        return response;
      } finally {
        this.clearSession();
        this.sessionChecked = true;
      }
    },
  },
});
