import { defineStore } from "pinia";
import CONST from "../utils/const.js";
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
        CONST.API_PREFIX_PATH.LOCAL_HOST + CONST.REST_PATH.INQUIRY_SEND_MAIL,
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
