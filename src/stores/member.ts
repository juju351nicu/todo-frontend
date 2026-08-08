import { defineStore } from "pinia";

import Const from "@/constants/const.js";
import type {
  MemberCancelRequest,
  MemberCancelResponse,
  MemberDetailResponse,
  MemberListItem,
  MemberListResponse,
  MemberUpsertRequest,
  MemberUpsertResponse,
} from "@/types/member";
import Fetcher from "@/utils/rest";

interface MemberState {
  isLoading: boolean;
  memberListInfo: MemberListItem[];
}

const requireSuccess = (response: Response, operation: string): Response => {
  if (!response.ok) {
    throw new Error(`${operation}に失敗しました。status=${response.status}`);
  }
  return response;
};

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
        const response = requireSuccess(
          await Fetcher.getRequest(
            `${Const.REST_PATH.MEMBER_DETAIL}/${memberId}`
          ),
          "会員詳細の取得"
        );
        return (await response.json()) as MemberDetailResponse;
      } finally {
        this.isLoading = false;
      }
    },

    /** 会員一覧情報を取得してStoreへ保持する。 */
    async findMemberList(): Promise<MemberListResponse | null> {
      this.isLoading = true;
      try {
        const response = requireSuccess(
          await Fetcher.getRequest(Const.REST_PATH.MEMBER_LIST),
          "会員一覧の取得"
        );
        const data = (await response.json()) as MemberListResponse;
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
        const urlParams = new URLSearchParams();
        memberIds.forEach((memberId) => {
          urlParams.append("ids", String(memberId));
        });
        const response = requireSuccess(
          await Fetcher.deleteRequest(
            `${Const.REST_PATH.MEMBER_DELETE}?${urlParams.toString()}`
          ),
          "会員情報の削除"
        );
        return (await response.json()) as MemberListResponse;
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
        const response = requireSuccess(
          await Fetcher.postRequest(Const.REST_PATH.MEMBER_UPSERT, payload),
          "会員情報の保存"
        );
        return (await response.json()) as MemberUpsertResponse;
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
        const response = requireSuccess(
          await Fetcher.postRequest(Const.REST_PATH.MEMBER_CANCEL, payload),
          "退会処理"
        );
        return (await response.json()) as MemberCancelResponse;
      } catch (error: unknown) {
        console.error(error);
        return null;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
