import { reactive, ref } from "vue";

import { useTodoStore } from "@/features/task/stores/task";
import type {
  TodoListRequest,
  TodoListResponse,
} from "@/features/task/types/task";
import {
  buildTodoCalendarEvents,
  buildTodoCalendarOptions,
} from "@/features/task/utils/taskCalendar";
import type { ErrorResponse } from "@/shared/types/error";
import { toNumberList } from "@/shared/utils/number";

/** Todoカレンダー画面の状態と操作を提供する。 */
export const useTodoCalendarPage = () => {
  const todoStore = useTodoStore();

  const calendarOptions = reactive(buildTodoCalendarOptions());
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const searchTitle = ref("");
  const selectedDoneFlag = ref<string[]>(["0", "1"]);

  const createSearchRequest = (): TodoListRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: toNumberList(selectedDoneFlag.value),
  });

  const setResponseErrors = (errorResponse: ErrorResponse): void => {
    errorMessages.value = (errorResponse.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    if (errorMessages.value.length === 0) {
      errorMessages.value = ["Todoカレンダーを取得できませんでした。"];
    }
  };

  const loadCalendar = async (payload: TodoListRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const response = await todoStore.findCalendarList(payload);
      if (!response.ok) {
        setResponseErrors((await response.json()) as ErrorResponse);
        return;
      }
      const data = (await response.json()) as TodoListResponse;
      calendarOptions.events = buildTodoCalendarEvents(data.todoList);
    } catch (_error: unknown) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
    } finally {
      isLoading.value = false;
    }
  };

  /** 初期条件でTodoカレンダーを取得する。 */
  const initialize = async (): Promise<void> => {
    await loadCalendar(createSearchRequest());
  };

  /** 入力された検索条件でTodoカレンダーを取得する。 */
  const search = async (): Promise<void> => {
    await loadCalendar(createSearchRequest());
  };

  return {
    calendarOptions,
    errorMessages,
    initialize,
    isLoading,
    search,
    searchTitle,
    selectedDoneFlag,
  };
};
