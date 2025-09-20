import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";

export const useMemberStore = defineStore("member", {
  state: () => ({
    isLoading: false,
    memberListInfo: [],
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
    deleteMemberList(param) {
      this.isLoading = true;
      Fetcher.deleteRequest(Const.REST_PATH.MEMBER_DELETE + "?" + param)
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
    }
  },
});
