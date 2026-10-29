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
     * @returns 会員一覧Response
     * @throws MemberApiError 一覧APIが失敗した場合（Storeの一覧は変えない。表示と401の扱いは画面が行う）
     */
    async findMemberList(): Promise<MemberListResponse> {
      this.isLoading = true;
      try {
        const data = await MemberApi.findList();
        this.memberListInfo = data.memberList;
        return data;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 指定された会員を削除し、Backendが返した削除後の一覧でStoreの一覧を置き換える。
     * 削除した会員が画面に残らないよう、一覧はBackendの削除後の一覧で置き換える。
     *
     * @param memberIds 削除対象の会員ID
     * @returns Backend Response（削除後の一覧）
     * @throws MemberApiError 削除APIが失敗した場合（Storeの一覧は変えない）
     */
    async deleteMemberList(memberIds: ReadonlyArray<number | string>): Promise<MemberListResponse> {
      this.isLoading = true;
      try {
        const data = await MemberApi.deleteMembers(memberIds);
        this.memberListInfo = data.memberList;
        return data;
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 会員情報を登録または更新する。
     *
     * @param payload 会員IDが0なら登録、それ以外は更新する入力情報
     * @returns 確定済み会員情報
     * @throws MemberApiError 保存APIが失敗した場合
     */
    async upsertMemberInfo(payload: MemberUpsertRequest): Promise<MemberUpsertResponse> {
      this.isLoading = true;
      try {
        return await MemberApi.upsert(payload);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * ログイン中の会員をパスワード確認付きで退会させる。
     *
     * @param payload 対象会員IDと平文パスワード。Storeへ保持しない
     * @returns 対象会員ID
     * @throws MemberApiError 退会APIが失敗した場合（パスワード不一致を含む）
     */
    async cancelMemberInfo(payload: MemberCancelRequest): Promise<MemberCancelResponse> {
      this.isLoading = true;
      try {
        return await MemberApi.cancel(payload);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
