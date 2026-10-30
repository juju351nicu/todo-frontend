import { defineStore } from "pinia";

import TaskListApi from "@/features/task-list/api/taskListApi";
import type {
  TaskListDetailResponse,
  TaskListSearchRequest,
  TaskListSearchResponse,
  TaskListUpsertRequest,
} from "@/features/task-list/types/taskList";

interface TaskListState {
  isLoading: boolean;
}

/** Task一覧の画面（一覧・詳細・カレンダー）が使うAPI呼出しと、通信中状態を管理するPinia Store。 */
export const useTaskListStore = defineStore("taskList", {
  state: (): TaskListState => ({
    isLoading: false,
  }),
  actions: {
    /**
     * Task IDに該当する詳細情報を取得する。
     *
     * @param taskId 取得対象のTask ID
     * @returns 認可済みTask詳細
     */
    async findTaskDetail(taskId: number): Promise<TaskListDetailResponse> {
      this.isLoading = true;
      try {
        return await TaskListApi.findDetail(taskId);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Task一覧情報を取得する。
     *
     * @param payload Task一覧の検索条件
     * @returns 認可・Validation確認済みのTask一覧
     */
    findTaskList(payload: TaskListSearchRequest): Promise<TaskListSearchResponse> {
      return TaskListApi.findList(payload);
    },

    /**
     * Taskカレンダー情報を取得する。
     *
     * @param payload カレンダー検索条件
     * @returns Taskと休日を含む認可済み一覧
     */
    findCalendarList(payload: TaskListSearchRequest): Promise<TaskListSearchResponse> {
      return TaskListApi.findCalendar(payload);
    },

    /**
     * Taskを完了状態にする。
     *
     * @param taskId 完了させるTask ID
     */
    completeTask(taskId: number): Promise<void> {
      return TaskListApi.complete(taskId);
    },

    /**
     * Task情報を登録または更新する。
     *
     * @param payload snake_case形式のTask入力
     */
    upsertTaskInfo(payload: TaskListUpsertRequest): Promise<void> {
      return TaskListApi.upsert(payload);
    },
  },
});
