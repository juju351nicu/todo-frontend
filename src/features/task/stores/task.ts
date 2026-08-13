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

/** Todo画面間で共有する一覧と通信中状態を管理するPinia Store。 */
export const useTodoStore = defineStore("todo", {
  state: (): TodoState => ({
    isLoading: false,
    todoListInfo: [],
  }),
  actions: {
    /**
     * Todo IDに該当する詳細情報を取得する。
     *
     * @param todoId 取得対象のTodo ID
     * @returns 認可済みTodo詳細
     */
    async findTodoDetail(todoId: number): Promise<TodoDetailResponse> {
      this.isLoading = true;
      try {
        return await TaskApi.findDetail(todoId);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Todo一覧情報をStoreへ保持する。
     *
     * @param payload Backendが認可済みのTodo一覧
     */
    setTodoList(payload: TodoListItem[]): void {
      this.todoListInfo = payload;
    },

    /**
     * Todo一覧情報を取得する。レスポンス本文は画面側で処理する。
     *
     * @param payload Todo検索条件
     * @returns Validation結果を含むBackend Response
     */
    findTodoList(payload: TodoListRequest): Promise<Response> {
      return TaskApi.findList(payload);
    },

    /**
     * Todoカレンダー情報を取得する。レスポンス本文は画面側で処理する。
     *
     * @param payload カレンダー検索条件
     * @returns Todoと休日を含むBackend Response
     */
    findCalendarList(payload: TodoListRequest): Promise<Response> {
      return TaskApi.findCalendar(payload);
    },

    /**
     * Todoを完了状態にする。
     *
     * @param todoId 完了させるTodo ID
     * @returns Backendの認可・更新結果Response
     */
    completeTodo(todoId: number): Promise<Response> {
      return TaskApi.complete(todoId);
    },

    /**
     * Todo情報を登録または更新する。
     *
     * @param payload snake_case形式のTodo入力
     * @returns Backendの認可・保存結果Response
     */
    upsertTodoInfo(payload: TodoUpsertRequest): Promise<Response> {
      return TaskApi.upsert(payload);
    },
  },
});
