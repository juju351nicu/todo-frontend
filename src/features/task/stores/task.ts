import { defineStore } from "pinia";

import TaskApi from "@/features/task/api/taskApi";
import type {
  MyTaskListResponse,
  TodoDetailResponse,
  TodoListItem,
  TodoListRequest,
  TodoListResponse,
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
     * Todo一覧情報を取得する。
     *
     * @param payload Todo検索条件
     * @returns 認可・Validation確認済みのTodo一覧
     */
    findTodoList(payload: TodoListRequest): Promise<TodoListResponse> {
      return TaskApi.findList(payload);
    },

    /**
     * Backendで本人・Project・状態を絞り込んだMy Tasks一覧を取得する。
     *
     * @returns 業務日と本人担当の未完了Project Task
     */
    findMyTasks(): Promise<MyTaskListResponse> {
      return TaskApi.findMyTasks();
    },

    /**
     * Todoカレンダー情報を取得する。
     *
     * @param payload カレンダー検索条件
     * @returns Todoと休日を含む認可済み一覧
     */
    findCalendarList(payload: TodoListRequest): Promise<TodoListResponse> {
      return TaskApi.findCalendar(payload);
    },

    /**
     * Todoを完了状態にする。
     *
     * @param todoId 完了させるTodo ID
     */
    completeTodo(todoId: number): Promise<void> {
      return TaskApi.complete(todoId);
    },

    /**
     * My TasksのProject Taskを完了にする（完了列の末尾へ移す）。旧Todoの`completeTodo`とは別のAPIを使う。
     *
     * @param projectId Taskが属するProject ID
     * @param taskId    完了にするTask ID
     * @param version   取得時点のversion
     * @throws TaskApiError 認証・認可失敗、未検出、競合の場合
     */
    completeMyTask(projectId: number, taskId: number, version: number): Promise<void> {
      return TaskApi.completeMyTask(projectId, taskId, version);
    },

    /**
     * Todo情報を登録または更新する。
     *
     * @param payload snake_case形式のTodo入力
     */
    upsertTodoInfo(payload: TodoUpsertRequest): Promise<void> {
      return TaskApi.upsert(payload);
    },
  },
});
