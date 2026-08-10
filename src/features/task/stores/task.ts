import { defineStore } from "pinia";

import TaskApi from "@/features/task/api/taskApi";
import type {
  TodoDetailResponse,
  TodoListItem,
  TodoListRequest,
  TodoUpsertRequest,
} from "@/features/task/types/task";

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
        return await TaskApi.findDetail(todoId);
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
      return TaskApi.findList(payload);
    },

    /** Todoカレンダー情報を取得する。レスポンス本文は画面側で処理する。 */
    findCalendarList(payload: TodoListRequest): Promise<Response> {
      return TaskApi.findCalendar(payload);
    },

    /** Todoを完了状態にする。 */
    completeTodo(todoId: number): Promise<Response> {
      return TaskApi.complete(todoId);
    },

    /** Todo情報を登録または更新する。 */
    upsertTodoInfo(payload: TodoUpsertRequest): Promise<Response> {
      return TaskApi.upsert(payload);
    },
  },
});
