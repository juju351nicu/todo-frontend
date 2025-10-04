import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";

export const useMemberStore = defineStore("member", {
  state: () => ({
    isLoading: false,
    memberListInfo: [{
      memberId: 0,
      lastName: "",
      firstName: "",
      loginId: "",
      password: "",
      email: "",
      role: "",
      version: "",
    }],
  }),
  getters: {},
  actions: {
    getMemberList() {
      this.isLoading = true;
      Fetcher.getRequest(Const.REST_PATH.MEMBER_LIST)
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then((data) => {
          this.memberListInfo = data.memberList;
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
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
        .then((data) => {
          console.log(data);
          this.isLoading = false;
        })
        .catch((error) => {
          console.log(error);
        });
    },
    upsertMemberInfo(payload) {
      this.isLoading = true;
      Fetcher.postRequest(
        Const.REST_PATH.MEMBER_UPSERT,
        payload
      )
        .then((response) => {
          console.log(response.status);
          return response.json();
        })
        .then((data) => {
          console.log(data);
          this.isLoading = false;
          this.isShowModal = true;
        })
        .catch((error) => {
          console.log(error);
        });
    },
  },
});
