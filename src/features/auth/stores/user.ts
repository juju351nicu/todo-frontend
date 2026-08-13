import { defineStore } from "pinia";

import type {
  LoginRequest,
  PermissionCode,
  RoleCode,
  SessionUserResponse,
} from "@/features/auth/types/auth";
import AuthApi from "@/features/auth/api/authApi";

interface UserState {
  memberId: number | null;
  username: string | null;
  displayName: string | null;
  roleCodes: RoleCode[];
  permissionCodes: PermissionCode[];
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
    isAuthenticated: (state): boolean => state.authenticated,
    hasRole:
      (state) =>
      (roleCode: RoleCode): boolean =>
        state.roleCodes.includes(roleCode),
    /**
     * 指定したBackend permissionを現在のSession利用者が持つか判定する。
     * 画面制御を補助するgetterであり、APIの最終認可を代替しない。
     */
    hasPermission:
      (state) =>
      (permissionCode: PermissionCode): boolean =>
        state.permissionCodes.includes(permissionCode),
    /** 指定したBackend permissionのうち1件以上を持つか判定する。 */
    hasAnyPermission:
      (state) =>
      (permissionCodes: readonly PermissionCode[]): boolean =>
        permissionCodes.some((permissionCode) =>
          state.permissionCodes.includes(permissionCode)
        ),
  },
  actions: {
    /** Session APIの利用者情報を、画面遷移をまたぐ認証状態へ保存する。 */
    setSessionUser(payload: SessionUserResponse): void {
      this.memberId = payload.accountId;
      this.username = payload.username;
      this.displayName = payload.displayName;
      this.roleCodes = [...(payload.roleCodes ?? [])];
      this.permissionCodes = [...(payload.permissionCodes ?? [])];
      this.authenticated = true;
      this.sessionChecked = true;
    },
    /** Frontendが保持する認証表示情報を破棄する。HttpSessionの破棄はlogout APIが担当する。 */
    clearSession(): void {
      this.memberId = null;
      this.username = null;
      this.displayName = null;
      this.roleCodes = [];
      this.permissionCodes = [];
      this.authenticated = false;
    },
    /**
     * BackendのHttpSessionから認証状態を復元する。
     *
     * @param force 既に確認済みでもSession APIを再実行する場合はtrue
     * @returns 認証済みの場合はtrue、未認証または確認失敗の場合はfalse
     */
    async restoreSession(force = false): Promise<boolean> {
      if (this.sessionChecked && !force) {
        return this.authenticated;
      }
      try {
        const sessionUser = await AuthApi.getSession();
        if (!sessionUser) {
          this.clearSession();
          return false;
        }
        this.setSessionUser(sessionUser);
        return true;
      } catch (_error: unknown) {
        this.clearSession();
        return false;
      } finally {
        this.sessionChecked = true;
      }
    },
    /**
     * ローカルログインを実行し、成功時だけSession利用者とpermissionを再取得する。
     *
     * @param payload ログインIDと平文パスワード。Storeへ永続化しない
     * @returns Backendの認証結果Response
     */
    async authLogin(payload: LoginRequest): Promise<Response> {
      const response = await AuthApi.login(payload);
      if (response.ok) {
        await this.restoreSession(true);
      }
      return response;
    },
    /**
     * BackendのHttpSessionを無効化し、API失敗時もFrontendの認証表示情報を必ず破棄する。
     *
     * @returns BackendのログアウトResponse
     */
    async logout(): Promise<Response> {
      try {
        return await AuthApi.logout();
      } finally {
        this.clearSession();
        this.sessionChecked = true;
      }
    },
  },
});
