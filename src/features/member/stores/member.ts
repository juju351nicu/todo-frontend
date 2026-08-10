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

export const useMemberStore = defineStore("member", {
  state: (): MemberState => ({
    isLoading: false,
    memberListInfo: [],
  }),
  actions: {
    /** 会員IDに該当する詳細情報を取得する。 */
    async findMemberDetail(memberId: number): Promise<MemberDetailResponse> {
      this.isLoading = true;
      try {
        return await MemberApi.findDetail(memberId);
      } finally {
        this.isLoading = false;
      }
    },

    /** 会員一覧情報を取得してStoreへ保持する。 */
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

    /** 指定された会員を削除する。 */
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

    /** 会員情報を登録または更新する。 */
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

    /** ログイン中の会員を退会させる。 */
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
