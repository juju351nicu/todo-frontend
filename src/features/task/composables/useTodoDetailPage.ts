import { computed, reactive, ref, watch, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import { TaskApiError } from "@/features/task/api/taskApi";
import { useTodoStore } from "@/features/task/stores/task";
import type { TodoDetailResponse } from "@/features/task/types/task";
import {
  LEGACY_TODO_ERROR_CODES,
  TASK_RECOVERY_PRIORITY_STATUSES,
} from "@/features/task/utils/apiErrors";
import {
  buildTodoUpsertRequest,
  createTodoDetailForm,
  type TodoDetailForm,
} from "@/features/task/utils/taskForm";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { resolveApiErrorMessages } from "@/shared/utils/apiError";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/**
 * 「登録する」「更新する」ボタンに付ける`data-todo-detail-control`属性の値。
 * 確認Dialogを「戻る」「更新」で閉じると、親画面の`v-if`がDialogを消すため、Dialogがフォーカスを戻せずbodyへ外れる
 * （Escで閉じたときはDialog自身が戻す）。そこで閉じた後にこのボタンへ戻す（動作確認/16_Todo G-5）。
 */
export const TODO_SUBMIT_CONTROL = "submit";

/** 確認Dialogを閉じた後に、「登録する」「更新する」ボタンへフォーカスを戻す。 */
const restoreSubmitFocus = (): Promise<void> =>
  focusFirstEnabledElement([`[data-todo-detail-control="${TODO_SUBMIT_CONTROL}"]`]);

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
 * Todo詳細・登録画面の取得、入力、確認および保存操作を提供する。
 * `TASK_WRITE_ALL`だけが所有者指定UIを利用でき、本人更新permissionではBackendが所有者を固定する。
 */
export const useTodoDetailPage = (todoId: Readonly<Ref<number | undefined>>) => {
  const router = useRouter();
  const todoStore = useTodoStore();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const errorMessages = ref<string[]>([]);
  const isShowConfirm = ref(false);
  const isSubmitting = ref(false);
  const loadError = ref("");
  const successMessage = ref("");
  const todoForm = reactive<TodoDetailForm>(createTodoDetailForm());

  const normalizedTodoId = computed<number>(() => {
    const value = todoId.value ?? 0;
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  const isLoading = computed(() => todoStore.isLoading || isSubmitting.value);
  const canAssignTodoOwner = computed(() =>
    userStore.hasPermission("TASK_WRITE_ALL")
  );
  const canWriteTodo = computed(() => {
    if (userStore.hasPermission("TASK_WRITE_ALL")) {
      return true;
    }
    if (!userStore.hasPermission("TASK_WRITE_OWN")) {
      return false;
    }
    return (
      normalizedTodoId.value === 0 || todoForm.userId === userStore.memberId
    );
  });
  /** Backendが返した担当者の「姓 名」。新規登録中と、姓・名のない会員ではnull。 */
  const ownerName = ref<string | null>(null);
  /** 「対象ユーザー」欄の表示。担当者名を優先し、名前がなければユーザーIDで示す（改善提案 1-17）。 */
  const fullName = computed(() => {
    if (todoForm.userId <= 0) {
      return "対象ユーザーなし";
    }
    return ownerName.value ?? `ユーザーID: ${todoForm.userId}`;
  });

  /** 取得・保存処理が表示したメッセージを次の画面操作前に破棄する。 */
  const clearMessages = (): void => {
    errorMessages.value = [];
    loadError.value = "";
    successMessage.value = "";
  };

  /** Todoフォームを新規登録用の既定値へ戻す。 */
  const resetForm = (): void => {
    Object.assign(todoForm, createTodoDetailForm());
    ownerName.value = null;
  };

  /** Backendの確定Responseを編集フォームへ置き換える。 */
  const applyTodoDetail = (detail: TodoDetailResponse): void => {
    Object.assign(todoForm, createTodoDetailForm(detail));
    ownerName.value = detail.owner_name ?? null;
  };

  /** 認証・認可状態が変化した場合にServer由来のフォームとDialogを破棄する。 */
  const clearProtectedState = (): void => {
    resetForm();
    isShowConfirm.value = false;
  };

  /** API statusと契約済みerror codeを旧Todo詳細向け表示へ変換する。 */
  const getErrorMessages = (
    error: unknown,
    fallback: string,
    forbidden: string
  ): string[] => {
    if (!(error instanceof TaskApiError)) {
      return [DISPLAY_MESSAGES.common.connectionFailed];
    }
    if (error.status === 403) {
      return [forbidden];
    }
    if (error.status === 404) {
      return [DISPLAY_MESSAGES.task.todo.resourceNotFound];
    }
    return resolveApiErrorMessages(
      error.errorResponse,
      LEGACY_TODO_ERROR_CODES,
      fallback
    );
  };

  /** 401ではフォームとSession表示を破棄してLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof TaskApiError) || error.status !== 401) {
      return false;
    }
    clearProtectedState();
    clearMessages();
    await expireSession();
    return true;
  };

  /** 現在のTodo IDを再取得し、取得時点versionを含むフォームへ置き換える。 */
  const replaceTodoDetail = async (): Promise<void> => {
    const detail = await todoStore.findTodoDetail(normalizedTodoId.value);
    applyTodoDetail(detail);
  };

  /** Todo詳細をAPIから取得し、編集フォームへ復元する。 */
  const loadTodoDetail = async (): Promise<void> => {
    resetForm();
    clearMessages();
    if (normalizedTodoId.value === 0) {
      return;
    }

    try {
      await replaceTodoDetail();
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        loadError.value = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.todo.detailLoadFailed,
          DISPLAY_MESSAGES.task.todo.readForbidden
        )[0];
      }
    }
  };

  /** 新規フォームを初期化し、編集フォームは取得時の内容へ戻す。 */
  const clearForm = async (): Promise<void> => {
    await loadTodoDetail();
  };

  const showConfirm = (): void => {
    if (!canWriteTodo.value) {
      errorMessages.value = [DISPLAY_MESSAGES.task.todo.operationForbidden];
      return;
    }
    isShowConfirm.value = true;
  };

  /** 確認Dialogを閉じ、「登録する」「更新する」へフォーカスを戻す。 */
  const closeConfirm = (): void => {
    isShowConfirm.value = false;
    void restoreSubmitFocus();
  };

  /** 確認済みのTodoを新規登録または更新する。 */
  const confirmSubmit = async (): Promise<void> => {
    closeConfirm();
    errorMessages.value = [];
    successMessage.value = "";
    if (!canWriteTodo.value) {
      errorMessages.value = [DISPLAY_MESSAGES.task.todo.operationForbidden];
      return;
    }
    const isUpdate = todoForm.todoId > 0;
    const payload = buildTodoUpsertRequest(todoForm);

    isSubmitting.value = true;
    try {
      await todoStore.upsertTodoInfo(payload);
      if (!isUpdate) {
        successMessage.value = "Todoを登録しました。";
        resetForm();
        return;
      }

      clearProtectedState();
      try {
        await replaceTodoDetail();
        successMessage.value = "Todoを更新しました。";
      } catch (reloadError: unknown) {
        if (await handleUnauthorized(reloadError)) return;
        if (
          reloadError instanceof TaskApiError &&
          TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
        ) {
          clearProtectedState();
          errorMessages.value = getErrorMessages(
            reloadError,
            DISPLAY_MESSAGES.task.todo.savedRefreshFailed,
            DISPLAY_MESSAGES.task.todo.readForbidden
          );
          return;
        }
        errorMessages.value = [DISPLAY_MESSAGES.task.todo.savedRefreshFailed];
      }
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return;
      if (
        isUpdate &&
        error instanceof TaskApiError &&
        error.status === 409
      ) {
        const conflictMessages = getErrorMessages(
          error,
          DISPLAY_MESSAGES.task.todo.conflict,
          DISPLAY_MESSAGES.task.todo.operationForbidden
        );
        clearProtectedState();
        try {
          await replaceTodoDetail();
          errorMessages.value = conflictMessages;
        } catch (reloadError: unknown) {
          if (await handleUnauthorized(reloadError)) return;
          if (
            reloadError instanceof TaskApiError &&
            TASK_RECOVERY_PRIORITY_STATUSES.has(reloadError.status)
          ) {
            clearProtectedState();
            errorMessages.value = getErrorMessages(
              reloadError,
              DISPLAY_MESSAGES.task.todo.reloadFailed,
              DISPLAY_MESSAGES.task.todo.readForbidden
            );
            return;
          }
          errorMessages.value = [
            ...conflictMessages,
            DISPLAY_MESSAGES.task.todo.reloadFailed,
          ];
        }
        return;
      }
      errorMessages.value = getErrorMessages(
        error,
        DISPLAY_MESSAGES.task.todo.saveFailed,
        DISPLAY_MESSAGES.task.todo.operationForbidden
      );
    } finally {
      isSubmitting.value = false;
    }
    // 401でLoginへ移った後は、部品が見つからないので何もしない。
    await restoreSubmitFocus();
  };

  watch(
    normalizedTodoId,
    () => {
      void loadTodoDetail();
    },
    { immediate: true }
  );

  return {
    canAssignTodoOwner,
    canWriteTodo,
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
    todoForm,
  };
};
