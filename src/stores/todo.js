import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";

export const useTodoStore = defineStore("todo", {
  state: () => ({
    isLoading: false,
    todoListInfo: [
      {
        todoId: 0,
        dateFrom: "",
        dateTo: "",
        title: "",
        detail: "",
        userId: 0,
        doneFlag: false,
        priority: 0,
        version: 0,
        idMemberMap: [],
        userList: []
      },
    ],
  }),
  getters: {},
  actions: {
    /**
     * Todo一覧情報を取得する
     */
    findTodoList() {
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
    /**
     * Todo情報を更新する
     */
    upsertTodoInfo(payload) {
      this.isLoading = true;
      Fetcher.postRequest(Const.REST_PATH.MEMBER_UPSERT, payload)
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
