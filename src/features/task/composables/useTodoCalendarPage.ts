import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";
import type { TodoListRequest } from "@/features/task/types/task";
import { LEGACY_TODO_ERROR_CODES } from "@/features/task/utils/apiErrors";
import {
  buildTodoCalendarEvents,
  buildTodoCalendarOptions,
} from "@/features/task/utils/taskCalendar";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { toNumberList } from "@/shared/utils/number";

/** Todoカレンダー画面の状態と操作を提供する。 */
export const useTodoCalendarPage = () => {
  const router = useRouter();
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
    if (!(error instanceof TaskApiError) || error.status !== 401) {
      return false;
    }
    calendarOptions.events = [];
    errorMessages.value = [];
    await expireSession();
    return true;
  };

  /** API statusと契約済みerror codeをCalendar向け表示へ変換する。 */
  const getErrorMessages = (error: unknown): string[] => {
    if (!(error instanceof TaskApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [DISPLAY_MESSAGES.task.todo.readForbidden];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      LEGACY_TODO_ERROR_CODES,
      DISPLAY_MESSAGES.task.todo.calendarLoadFailed
    );
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
        if (error instanceof TaskApiError && error.status === 403) {
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
