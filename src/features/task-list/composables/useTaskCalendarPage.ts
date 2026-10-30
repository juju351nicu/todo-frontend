import { reactive, ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import { useTaskListStore } from "@/features/task-list/stores/taskList";
import type { TaskListSearchRequest } from "@/features/task-list/types/taskList";
import { TASK_LIST_ERROR_CODES } from "@/features/task-list/utils/apiErrors";
import {
  buildTaskCalendarEvents,
  buildTaskCalendarOptions,
} from "@/features/task-list/utils/taskCalendar";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveStandardErrorMessages } from "@/shared/utils/apiError";
import { toNumberList } from "@/shared/utils/number";

/** Taskカレンダー画面の状態と操作を提供する。 */
export const useTaskCalendarPage = () => {
  const taskListStore = useTaskListStore();
  const { expireSession } = useSessionExpiry();

  const calendarOptions = reactive(buildTaskCalendarOptions());
  const errorMessages = ref<string[]>([]);
  const isLoading = ref(false);
  const searchTitle = ref("");
  const selectedDoneFlag = ref<string[]>(["0", "1"]);

  /** 画面の検索状態をBackendのsnake_case Requestへ変換する。 */
  const createSearchRequest = (): TaskListSearchRequest => ({
    search_title: searchTitle.value,
    date_range: "",
    done_flag_values: toNumberList(selectedDoneFlag.value),
  });

  /** 401ではCalendar eventとSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskListApiError) || error.status !== 401) {
      return false;
    }
    calendarOptions.events = [];
    errorMessages.value = [];
    await expireSession();
    return true;
  };

  /** API statusと契約済みerror codeをCalendar向け表示へ変換する。 */
  const getErrorMessages = (error: unknown): string[] => {
    return resolveStandardErrorMessages(error, TaskListApiError, {
      forbidden: DISPLAY_MESSAGES.task.taskList.readForbidden,
      knownErrorCodes: TASK_LIST_ERROR_CODES,
      fallback: DISPLAY_MESSAGES.task.taskList.calendarLoadFailed,
    });
  };

  /**
   * 指定条件のTaskと休日を取得し、FullCalendarのEventへ置き換える。
   * 通信失敗時は既存Eventを維持し、認証・認可状態変更時は保護されたEventを破棄する。
   */
  const loadCalendar = async (payload: TaskListSearchRequest): Promise<void> => {
    isLoading.value = true;
    errorMessages.value = [];
    try {
      const data = await taskListStore.findCalendarList(payload);
      calendarOptions.events = buildTaskCalendarEvents(data.taskList);
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        if (error instanceof TaskListApiError && error.status === 403) {
          calendarOptions.events = [];
        }
        errorMessages.value = getErrorMessages(error);
      }
    } finally {
      isLoading.value = false;
    }
  };

  /** 初期条件でTaskカレンダーを取得する。 */
  const initialize = async (): Promise<void> => {
    await loadCalendar(createSearchRequest());
  };

  /** 入力された検索条件でTaskカレンダーを取得する。 */
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
