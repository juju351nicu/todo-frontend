import { defineStore } from "pinia";

import Const from "@/constants/const";
import type {
  TodoDetailResponse,
  TodoListItem,
  TodoListRequest,
  TodoUpsertRequest,
} from "@/types/todo";
import Fetcher from "@/utils/rest";

interface TodoState {
  isLoading: boolean;
  todoListInfo: TodoListItem[];
}

export const useTodoStore = defineStore("todo", {
  state: (): TodoState => ({
    isLoading: false,
    todoListInfo: [],
  }),
  actions: {
    /** Todo IDに該当する詳細情報を取得する。 */
    async findTodoDetail(todoId: number): Promise<TodoDetailResponse> {
      this.isLoading = true;
      try {
        const response = await Fetcher.getRequest(
          `${Const.REST_PATH.TODO_DETAIL}/${todoId}`
        );
        if (!response.ok) {
          throw new Error(
            `Todo詳細の取得に失敗しました。status=${response.status}`
          );
        }
        return (await response.json()) as TodoDetailResponse;
      } finally {
        this.isLoading = false;
      }
    },

    /** Todo一覧情報をStoreへ保持する。 */
    setTodoList(payload: TodoListItem[]): void {
      this.todoListInfo = payload;
    },

    /** Todo一覧情報を取得する。レスポンス本文は画面側で処理する。 */
    findTodoList(payload: TodoListRequest): Promise<Response> {
      return Fetcher.postRequest(Const.REST_PATH.TODO_LIST, payload);
    },

    /** Todoカレンダー情報を取得する。レスポンス本文は画面側で処理する。 */
    findCalendarList(payload: TodoListRequest): Promise<Response> {
      return Fetcher.postRequest(Const.REST_PATH.TODO_CALENDAR, payload);
    },

    /** Todoを完了状態にする。 */
    completeTodo(todoId: number): Promise<Response> {
      const query = new URLSearchParams({ todo_id: String(todoId) });
      return Fetcher.postRequest(`${Const.REST_PATH.TODO_DONE}?${query}`, null);
    },

    /** Todo情報を登録または更新する。 */
    upsertTodoInfo(payload: TodoUpsertRequest): Promise<Response> {
      return Fetcher.postRequest(Const.REST_PATH.TODO_UPSERT, payload);
    },
  },
});
