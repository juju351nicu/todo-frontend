import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest";

export const useMemberStore = defineStore("member", {
  state: () => ({
    isLoading: false,
    memberListInfo: [
      {
        memberId: 0,
        lastName: "",
        firstName: "",
        loginId: "",
        password: "",
        email: "",
        role: "",
        version: "",
      },
    ],
  }),
  getters: {},
  actions: {
    /**
     * 会員詳細情報を取得する
     *
     * @param {number} memberId 会員ID
     * @returns {Promise<Object>} 会員詳細情報
     */
    async findMemberDetail(memberId) {
      this.isLoading = true;
      try {
        const response = await Fetcher.getRequest(
          `${Const.REST_PATH.MEMBER_DETAIL}/${memberId}`
        );
        if (!response.ok) {
          throw new Error(`会員詳細の取得に失敗しました。status=${response.status}`);
        }
        return await response.json();
      } finally {
        this.isLoading = false;
      }
    },
    /**
     * 会員一覧情報を取得する
     */
    findMemberList() {
      this.isLoading = true;
      return Fetcher.getRequest(Const.REST_PATH.MEMBER_LIST)
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          this.memberListInfo = data.memberList;
          return data;
        })
        .catch((error) => {
          console.error(error);
          return null;
        })
        .finally(() => {
          this.isLoading = false;
        });
    },
    /**
     * 会員情報を削除する
     */
    deleteMemberList(payload) {
      this.isLoading = true;
      const urlParams = new URLSearchParams();
      payload.forEach((id) => {
        urlParams.append("ids", id);
      });
      Fetcher.deleteRequest(
        Const.REST_PATH.MEMBER_DELETE + "?" + urlParams.toString()
      )
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then(() => {
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
    /**
     * 会員情報を更新する
     */
    upsertMemberInfo(payload) {
      this.isLoading = true;
      Fetcher.postRequest(Const.REST_PATH.MEMBER_UPSERT, payload)
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then(() => {
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
    /**
     * 会員を退会する
     */
    cancelMemberInfo(payload) {
      this.isLoading = true;
      Fetcher.postRequest(Const.REST_PATH.MEMBER_CANCEL, payload)
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then((data) => {
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
  },
});
