import { reactive, ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { TodoApiError } from "@/features/todo/api/todoApi";
import { useTodoStore } from "@/features/todo/stores/todo";
import type { TodoListRequest } from "@/features/todo/types/todo";
import { LEGACY_TODO_ERROR_CODES } from "@/features/todo/utils/apiErrors";
import {
  buildTodoCalendarEvents,
  buildTodoCalendarOptions,
} from "@/features/todo/utils/todoCalendar";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveStandardErrorMessages } from "@/shared/utils/apiError";
import { toNumberList } from "@/shared/utils/number";

/** Todoカレンダー画面の状態と操作を提供する。 */
export const useTodoCalendarPage = () => {
  const todoStore = useTodoStore();
  const { expireSession } = useSessionExpiry();

  const calendarOptions = reactive(buildTodoCalendarOptions());
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const searchTitle = ref("");
  const selectedDoneFlag = ref<string[]>(["0", "1"]);

  /** 画面の検索状態をBackendのsnake_case Requestへ変換する。 */
  const createSearchRequest = (): TodoListRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: toNumberList(selectedDoneFlag.value),
  });

  /** 401ではCalendar eventとSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TodoApiError) || error.status !== 401) {
      return false;
    }
    calendarOptions.events = [];
    errorMessages.value = [];
    await expireSession();
    return true;
  };

  /** API statusと契約済みerror codeをCalendar向け表示へ変換する。 */
  const getErrorMessages = (error: unknown): string[] => {
    return resolveStandardErrorMessages(error, TodoApiError, {
      forbidden: DISPLAY_MESSAGES.task.todo.readForbidden,
      knownErrorCodes: LEGACY_TODO_ERROR_CODES,
      fallback: DISPLAY_MESSAGES.task.todo.calendarLoadFailed,
    });
  };

  /**
   * 指定条件のTodoと休日を取得し、FullCalendarのEventへ置き換える。
   * 通信失敗時は既存Eventを維持し、認証・認可状態変更時は保護されたEventを破棄する。
   */
  const loadCalendar = async (payload: TodoListRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const data = await todoStore.findCalendarList(payload);
      calendarOptions.events = buildTodoCalendarEvents(data.todoList);
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (error instanceof TodoApiError && error.status === 403) {
          calendarOptions.events = [];
        }
        errorMessages.value = getErrorMessages(error);
      }
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
