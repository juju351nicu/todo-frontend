import { defineStore } from "pinia";
import Const from "../utils/const.js";
import Fetcher from "../utils/rest.js";

export const useInquiryStore = defineStore("inquiry", {
  state: () => ({
    isLoading: false,
  }),
  getters: {},
  actions: {
    recieveInquiryInfo(payload) {
      this.isLoading = true;
      Fetcher.postRequest(
        Const.REST_PATH.INQUIRY_SEND_MAIL,
        payload
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
  },
});
