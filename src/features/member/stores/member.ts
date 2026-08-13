import { defineStore } from "pinia";

import MemberApi from "@/features/member/api/memberApi";
import type {
  MemberCancelRequest,
  MemberCancelResponse,
  MemberDetailResponse,
  MemberListItem,
  MemberListResponse,
  MemberUpsertRequest,
  MemberUpsertResponse,
} from "@/features/member/types/member";

interface MemberState {
  isLoading: boolean;
  memberListInfo: MemberListItem[];
}

/** 会員画面間で共有する一覧と通信中状態を管理するPinia Store。 */
export const useMemberStore = defineStore("member", {
  state: (): MemberState => ({
    isLoading: false,
    memberListInfo: [],
  }),
  actions: {
    /**
     * 会員IDに該当する詳細情報を取得する。
     *
     * @param memberId 取得対象の会員ID
     * @returns パスワードを含まない会員詳細
     */
    async findMemberDetail(memberId: number): Promise<MemberDetailResponse> {
      this.isLoading = true;
      try {
        return await MemberApi.findDetail(memberId);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 会員一覧情報を取得してStoreへ保持する。
     *
     * @returns 取得成功時は一覧Response、失敗時はnull
     */
    async findMemberList(): Promise<MemberListResponse | null> {
      this.isLoading = true;
      try {
        const data = await MemberApi.findList();
        this.memberListInfo = data.memberList;
        return data;
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 指定された会員を削除する。
     *
     * @param memberIds 削除対象の会員ID
     * @returns 削除成功時はBackend Response、失敗時はnull
     */
    async deleteMemberList(
      memberIds: ReadonlyArray<number | string>
    ): Promise<MemberListResponse | null> {
      this.isLoading = true;
      try {
        return await MemberApi.deleteMembers(memberIds);
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 会員情報を登録または更新する。
     *
     * @param payload 会員IDが0なら登録、それ以外は更新する入力情報
     * @returns 保存成功時は確定済み会員情報、失敗時はnull
     */
    async upsertMemberInfo(
      payload: MemberUpsertRequest
    ): Promise<MemberUpsertResponse | null> {
      this.isLoading = true;
      try {
        return await MemberApi.upsert(payload);
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * ログイン中の会員をパスワード確認付きで退会させる。
     *
     * @param payload 対象会員IDと平文パスワード。Storeへ保持しない
     * @returns 退会成功時は対象会員ID、失敗時はnull
     */
    async cancelMemberInfo(
      payload: MemberCancelRequest
    ): Promise<MemberCancelResponse | null> {
      this.isLoading = true;
      try {
        return await MemberApi.cancel(payload);
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
