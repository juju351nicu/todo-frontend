import { defineStore } from "pinia";

import Const from "@/constants/const.js";
import type {
  LoginRequest,
  RoleCode,
  SessionUserResponse,
} from "@/types/auth";
import Fetcher from "@/utils/rest";

interface UserState {
  memberId: number | null;
  username: string | null;
  displayName: string | null;
  roleCodes: RoleCode[];
  permissionCodes: string[];
  authenticated: boolean;
  sessionChecked: boolean;
}

export const useUserStore = defineStore("user", {
  state: (): UserState => ({
    memberId: null,
    username: null,
    displayName: null,
    roleCodes: [],
    permissionCodes: [],
    authenticated: false,
    sessionChecked: false,
  }),
  getters: {
    getRole: (state): number => {
      if (state.roleCodes.includes("SYSTEM_ADMIN")) {
        return 0;
      }
      if (state.roleCodes.includes("READ_ONLY_ADMIN")) {
        return 1;
      }
      return 2;
    },
    isAuthenticated: (state): boolean => state.authenticated,
    hasRole:
      (state) =>
      (roleCode: RoleCode): boolean =>
        state.roleCodes.includes(roleCode),
  },
  actions: {
    setSessionUser(payload: SessionUserResponse): void {
      this.memberId = payload.accountId;
      this.username = payload.username;
      this.displayName = payload.displayName;
      this.roleCodes = [...(payload.roleCodes ?? [])];
      this.permissionCodes = [...(payload.permissionCodes ?? [])];
      this.authenticated = true;
      this.sessionChecked = true;
    },
    clearSession(): void {
      this.memberId = null;
      this.username = null;
      this.displayName = null;
      this.roleCodes = [];
      this.permissionCodes = [];
      this.authenticated = false;
    },
    async restoreSession(force = false): Promise<boolean> {
      if (this.sessionChecked && !force) {
        return this.authenticated;
      }
      try {
        const response = await Fetcher.getRequest(Const.REST_PATH.SESSION);
        if (!response.ok) {
          this.clearSession();
          return false;
        }
        this.setSessionUser((await response.json()) as SessionUserResponse);
        return true;
      } catch (_error: unknown) {
        this.clearSession();
        return false;
      } finally {
        this.sessionChecked = true;
      }
    },
    async authLogin(payload: LoginRequest): Promise<Response> {
      const response = await Fetcher.postRequest(
        Const.REST_PATH.AUTH_LOGIN,
        payload
      );
      if (response.ok) {
        await Fetcher.refreshCsrfToken();
        await this.restoreSession(true);
      }
      return response;
    },
    async logout(): Promise<Response> {
      try {
        const response = await Fetcher.postRequest(
          Const.REST_PATH.LOGOUT,
          null
        );
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
