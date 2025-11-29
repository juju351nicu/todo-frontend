import { defineStore } from "pinia";
import Const from "@/constants/const.js";
import Fetcher from "@/utils/rest.js";

export const useTodoStore = defineStore("todo", {
  state: () => ({
    isLoading: false,
    todoListInfo: [
      {
        todoId: 0,
        start: "",
        end: "",
        title: "",
        detail: "",
        userId: 0,
        doneFlag: false,
        priority: 0,
        version: 0,
        idMemberMap: [],
        userList: [],
      },
    ],
  }),
  getters: {},
  actions: {
    /**
     * Todo一覧情報を設定する
     */
    setTodoList(payload) {
      this.todoListInfo = payload;
    },
    /**
     * Todo一覧情報を取得する
     */
    findTodoList(payload) {
      return Fetcher.postRequest(Const.REST_PATH.TODO_LIST, payload);
    },
    /**
     * Todoカレンダー一覧情報を取得する
     */
    findCalendarList(payload) {
      return Fetcher.postRequest(Const.REST_PATH.TODO_CALENDAR, payload);
    },
    /**
     * Todo情報を更新する
     */
    upsertTodoInfo(payload) {
      return Fetcher.postRequest(Const.REST_PATH.TODO_UPSERT, payload);
    },
  },
});
