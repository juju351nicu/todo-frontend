import { defineStore } from "pinia";

import AccountApi from "@/features/account/api/accountApi";
import type {
  AccountCancelRequest,
  AccountCancelResponse,
  AccountDetailResponse,
  AccountListItem,
  AccountListResponse,
  AccountRegisterRequest,
  AccountUpdateRequest,
} from "@/features/account/types/account";

interface AccountState {
  isLoading: boolean;
  accounts: AccountListItem[];
}

/** アカウント画面間で共有する一覧と通信中状態を管理するPinia Store。 */
export const useAccountStore = defineStore("account", {
  state: (): AccountState => ({
    isLoading: false,
    accounts: [],
  }),
  actions: {
    /**
     * アカウントIDに該当する詳細情報を取得する。
     *
     * @param accountId 取得対象のアカウントID
     * @returns パスワードを含まないアカウント詳細
     */
    async findAccountDetail(accountId: number): Promise<AccountDetailResponse> {
      this.isLoading = true;
      try {
        return await AccountApi.findDetail(accountId);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * アカウント一覧を取得してStoreへ保持する。
     *
     * @returns アカウント一覧Response
     * @throws AccountApiError 一覧APIが失敗した場合（Storeの一覧は変えない。表示と401の扱いは画面が行う）
     */
    async findAccountList(): Promise<AccountListResponse> {
      this.isLoading = true;
      try {
        const response = await AccountApi.findList();
        this.accounts = response.accounts;
        return response;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 指定されたアカウントを削除（無効化）し、Backendが返した削除後の一覧でStoreの一覧を置き換える。
     * 削除したアカウントが画面に残らないよう、一覧はBackendの削除後の一覧で置き換える。
     *
     * @param accountIds 削除対象のアカウントID
     * @returns Backend Response（削除後の一覧）
     * @throws AccountApiError 削除APIが失敗した場合（Storeの一覧は変えない）
     */
    async deleteAccounts(accountIds: ReadonlyArray<number | string>): Promise<AccountListResponse> {
      this.isLoading = true;
      try {
        const response = await AccountApi.deleteAccounts(accountIds);
        this.accounts = response.accounts;
        return response;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * アカウントを登録する。
     *
     * @param payload 登録内容
     * @returns 登録したアカウントの詳細
     * @throws AccountApiError 登録APIが失敗した場合
     */
    async registerAccount(payload: AccountRegisterRequest): Promise<AccountDetailResponse> {
      this.isLoading = true;
      try {
        return await AccountApi.register(payload);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * アカウントの情報を更新する。
     *
     * @param accountId 更新するアカウントID
     * @param payload 更新内容と、画面を開いたときのversion
     * @returns 更新後のアカウントの詳細
     * @throws AccountApiError 更新APIが失敗した場合
     */
    async updateAccount(
      accountId: number,
      payload: AccountUpdateRequest
    ): Promise<AccountDetailResponse> {
      this.isLoading = true;
      try {
        return await AccountApi.update(accountId, payload);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * ログイン中のアカウントをパスワード確認付きで退会させる。
     *
     * @param accountId 退会するアカウントID
     * @param payload 平文パスワード。Storeへ保持しない
     * @returns 退会したアカウントID
     * @throws AccountApiError 退会APIが失敗した場合（パスワード不一致を含む）
     */
    async cancelAccount(
      accountId: number,
      payload: AccountCancelRequest
    ): Promise<AccountCancelResponse> {
      this.isLoading = true;
      try {
        return await AccountApi.cancel(accountId, payload);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
