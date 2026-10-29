import { defineStore } from "pinia";

import TodoApi from "@/features/todo/api/todoApi";
import type {
  TodoDetailResponse,
  TodoListRequest,
  TodoListResponse,
  TodoUpsertRequest,
} from "@/features/todo/types/todo";

interface TodoState {
  isLoading: boolean;
}

/** 旧Todoの画面（一覧・詳細・カレンダー）が使うAPI呼出しと、通信中状態を管理するPinia Store。 */
export const useTodoStore = defineStore("todo", {
  state: (): TodoState => ({
    isLoading: false,
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
        return await TodoApi.findDetail(todoId);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Todo一覧情報を取得する。
     *
     * @param payload Todo検索条件
     * @returns 認可・Validation確認済みのTodo一覧
     */
    findTodoList(payload: TodoListRequest): Promise<TodoListResponse> {
      return TodoApi.findList(payload);
    },

    /**
     * Todoカレンダー情報を取得する。
     *
     * @param payload カレンダー検索条件
     * @returns Todoと休日を含む認可済み一覧
     */
    findCalendarList(payload: TodoListRequest): Promise<TodoListResponse> {
      return TodoApi.findCalendar(payload);
    },

    /**
     * Todoを完了状態にする。
     *
     * @param todoId 完了させるTodo ID
     */
    completeTodo(todoId: number): Promise<void> {
      return TodoApi.complete(todoId);
    },

    /**
     * Todo情報を登録または更新する。
     *
     * @param payload snake_case形式のTodo入力
     */
    upsertTodoInfo(payload: TodoUpsertRequest): Promise<void> {
      return TodoApi.upsert(payload);
    },
  },
});
