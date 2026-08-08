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
     * Todo詳細情報を取得する
     *
     * @param {number} todoId Todo ID
     * @returns {Promise<Object>} Todo詳細情報
     */
    async findTodoDetail(todoId) {
      this.isLoading = true;
      try {
        const response = await Fetcher.getRequest(
          `${Const.REST_PATH.TODO_DETAIL}/${todoId}`
        );
        if (!response.ok) {
          throw new Error(`Todo詳細の取得に失敗しました。status=${response.status}`);
        }
        return await response.json();
      } finally {
        this.isLoading = false;
      }
    },
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
     * Todoを完了にする
     */
    completeTodo(todoId) {
      const query = new URLSearchParams({ todo_id: String(todoId) });
      return Fetcher.postRequest(`${Const.REST_PATH.TODO_DONE}?${query}`, null);
    },
    /**
     * Todo情報を更新する
     */
    upsertTodoInfo(payload) {
      return Fetcher.postRequest(Const.REST_PATH.TODO_UPSERT, payload);
    },
  },
});
