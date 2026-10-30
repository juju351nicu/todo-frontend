import { computed, reactive, ref, watch, type Ref } from "vue";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { TASK_RECOVERY_PRIORITY_STATUSES } from "@/features/task/utils/apiErrors";
import { TaskListApiError } from "@/features/task-list/api/taskListApi";
import { useTaskListStore } from "@/features/task-list/stores/taskList";
import type { TaskListDetailResponse } from "@/features/task-list/types/taskList";
import { TASK_LIST_ERROR_CODES } from "@/features/task-list/utils/apiErrors";
import {
  buildTaskListUpsertRequest,
  createTaskListDetailForm,
  type TaskListDetailForm,
} from "@/features/task-list/utils/taskListForm";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveStandardErrorMessages } from "@/shared/utils/apiError";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 「登録する」「更新する」ボタンに付ける`data-task-list-detail-control`属性の値。
 * 確認Dialogを「戻る」「更新」で閉じると、親画面の`v-if`がDialogを消すため、Dialogがフォーカスを戻せずbodyへ外れる
 * （Escで閉じたときはDialog自身が戻す）。そこで閉じた後にこのボタンへ戻す。
 */
export const TASK_LIST_SUBMIT_CONTROL = "submit";

/** 確認Dialogを閉じた後に、「登録する」「更新する」ボタンへフォーカスを戻す。 */
const restoreSubmitFocus = (): Promise<void> =>
  focusFirstEnabledElement([`[data-task-list-detail-control="${TASK_LIST_SUBMIT_CONTROL}"]`]);

interface PriorityItem {
  priorityLabel: string;
  priority: number;
}

interface DoneFlagItem {
  doneFlagLabel: string;
  doneFlag: 0 | 1;
}

interface UserItem {
  userObjLabel: string;
  userObjId: number;
}

const PRIORITY_ITEMS: PriorityItem[] = [
  { priorityLabel: "低", priority: 1 },
  { priorityLabel: "中", priority: 2 },
  { priorityLabel: "高", priority: 3 },
];

const DONE_FLAG_ITEMS: DoneFlagItem[] = [
  { doneFlagLabel: "未完了", doneFlag: 0 },
  { doneFlagLabel: "完了", doneFlag: 1 },
];

const USER_ITEMS: UserItem[] = [
  { userObjLabel: "自分", userObjId: 0 },
  { userObjLabel: "全員", userObjId: -1 },
];

/**
 * Task詳細・登録画面の取得、入力、確認および保存操作を提供する。
 * `TASK_WRITE_ALL`だけが所有者指定UIを利用でき、本人更新permissionではBackendが所有者を固定する。
 */
export const useTaskListDetailPage = (taskId: Readonly<Ref<number | undefined>>) => {
  const taskListStore = useTaskListStore();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const errorMessages = ref<string[]>([]);
  const isShowConfirm = ref(false);
  const isSubmitting = ref(false);
  const loadError = ref("");
  const successMessage = ref("");
  const taskListForm = reactive<TaskListDetailForm>(createTaskListDetailForm());

  const normalizedTaskId = computed<number>(() => {
    const value = taskId.value ?? 0;
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  const isLoading = computed(() => taskListStore.isLoading || isSubmitting.value);
  const canAssignTaskOwner = computed(() => userStore.hasPermission("TASK_WRITE_ALL"));
  const canWriteTask = computed(() => {
    if (userStore.hasPermission("TASK_WRITE_ALL")) {
      return true;
    }
    if (!userStore.hasPermission("TASK_WRITE_OWN")) {
      return false;
    }
    return normalizedTaskId.value === 0 || taskListForm.userId === userStore.accountId;
  });
  /** Backendが返した担当者の「姓 名」。新規登録中と、姓・名のないアカウントではnull。 */
  const ownerName = ref<string | null>(null);
  /** 「対象ユーザー」欄の表示。担当者名を優先し、名前がなければユーザーIDで示す。 */
  const fullName = computed(() => {
    if (taskListForm.userId <= 0) {
      return "対象ユーザーなし";
    }
    return ownerName.value ?? `ユーザーID: ${taskListForm.userId}`;
  });

  /** 取得・保存処理が表示したメッセージを次の画面操作前に破棄する。 */
  const clearMessages = (): void => {
    errorMessages.value = [];
    loadError.value = "";
    successMessage.value = "";
  };

  /** Taskフォームを新規登録用の既定値へ戻す。 */
  const resetForm = (): void => {
    Object.assign(taskListForm, createTaskListDetailForm());
    ownerName.value = null;
  };

  /** Backendの確定Responseを編集フォームへ置き換える。 */
  const applyTaskDetail = (detail: TaskListDetailResponse): void => {
    Object.assign(taskListForm, createTaskListDetailForm(detail));
    ownerName.value = detail.owner_name ?? null;
  };

  /** 認証・認可状態が変化した場合にServer由来のフォームとDialogを破棄する。 */
  const clearProtectedState = (): void => {
    resetForm();
    isShowConfirm.value = false;
  };

  /** API statusと契約済みerror codeをTask一覧の詳細画面向け表示へ変換する。 */
  const getErrorMessages = (error: unknown, fallback: string, forbidden: string): string[] => {
    return resolveStandardErrorMessages(error, TaskListApiError, {
      forbidden,
      notFound: DISPLAY_MESSAGES.task.taskList.resourceNotFound,
      knownErrorCodes: TASK_LIST_ERROR_CODES,
      fallback,
    });
  };

  /** 401ではフォームとSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskListApiError) || error.status !== 401) {
      return false;
    }
    clearProtectedState();
    clearMessages();
    await expireSession();
    return true;
  };

  /** 現在のTask IDを再取得し、取得時点versionを含むフォームへ置き換える。 */
  const replaceTaskDetail = async (): Promise<void> => {
    const detail = await taskListStore.findTaskDetail(normalizedTaskId.value);
    applyTaskDetail(detail);
  };

  /** Task詳細をAPIから取得し、編集フォームへ復元する。 */
  const loadTaskDetail = async (): Promise<void> => {
    resetForm();
    clearMessages();
    if (normalizedTaskId.value === 0) {
      return;
    }

    try {
      await replaceTaskDetail();
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        loadError.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.taskList.detailLoadFailed,
          DISPLAY_MESSAGES.task.taskList.readForbidden
        )[0];
      }
    }
  };

  /** 新規フォームを初期化し、編集フォームは取得時の内容へ戻す。 */
  const clearForm = async (): Promise<void> => {
    await loadTaskDetail();
  };

  const showConfirm = (): void => {
    if (!canWriteTask.value) {
      errorMessages.value = [DISPLAY_MESSAGES.task.taskList.operationForbidden];
      return;
    }
    isShowConfirm.value = true;
  };

  /** 確認Dialogを閉じ、「登録する」「更新する」へフォーカスを戻す。 */
  const closeConfirm = (): void => {
    isShowConfirm.value = false;
    void restoreSubmitFocus();
  };

  /** 確認済みのTaskを新規登録または更新する。 */
  const confirmSubmit = async (): Promise<void> => {
    closeConfirm();
    errorMessages.value = [];
    successMessage.value = "";
    if (!canWriteTask.value) {
      errorMessages.value = [DISPLAY_MESSAGES.task.taskList.operationForbidden];
      return;
    }
    const isUpdate = taskListForm.taskId > 0;
    const payload = buildTaskListUpsertRequest(taskListForm);

    isSubmitting.value = true;
    try {
      await taskListStore.upsertTaskInfo(payload);
      if (!isUpdate) {
        successMessage.value = "Taskを登録しました。";
        resetForm();
        return;
      }

      clearProtectedState();
      try {
        await replaceTaskDetail();
        successMessage.value = "Taskを更新しました。";
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskListApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.taskList.savedRefreshFailed,
            DISPLAY_MESSAGES.task.taskList.readForbidden
          );
          return;
        }
        errorMessages.value = [DISPLAY_MESSAGES.task.taskList.savedRefreshFailed];
      }
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      if (isUpdate && error instanceof TaskListApiError && error.status === 409) {
        const conflictMessages = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.taskList.conflict,
          DISPLAY_MESSAGES.task.taskList.operationForbidden
        );
        clearProtectedState();
        try {
          await replaceTaskDetail();
          errorMessages.value = conflictMessages;
        } catch (reloadError: unknown) {
          if (await handleUnauthorized(reloadError)) return;
          if (
            reloadError instanceof TaskListApiError &&
            TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
          ) {
            clearProtectedState();
            errorMessages.value = getErrorMessages(
              reloadError,
              DISPLAY_MESSAGES.task.taskList.reloadFailed,
              DISPLAY_MESSAGES.task.taskList.readForbidden
            );
            return;
          }
          errorMessages.value = [...conflictMessages, DISPLAY_MESSAGES.task.taskList.reloadFailed];
        }
        return;
      }
      errorMessages.value = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.taskList.saveFailed,
        DISPLAY_MESSAGES.task.taskList.operationForbidden
      );
    } finally {
      isSubmitting.value = false;
    }
    // 401でLoginへ移った後は、部品が見つからないので何もしない。
    await restoreSubmitFocus();
  };

  watch(
    normalizedTaskId,
    () => {
      void loadTaskDetail();
    },
    { immediate: true }
  );

  return {
    canAssignTaskOwner,
    canWriteTask,
    clearForm,
    closeConfirm,
    confirmSubmit,
    doneFlagItems: DONE_FLAG_ITEMS,
    errorMessages,
    fullName,
    fullNameItems: USER_ITEMS,
    isLoading,
    isShowConfirm,
    loadError,
    priorityItems: PRIORITY_ITEMS,
    showConfirm,
    successMessage,
    taskListForm,
  };
};
