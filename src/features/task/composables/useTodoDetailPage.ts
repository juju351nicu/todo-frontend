import { computed, reactive, ref, watch, type Ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import { useTodoStore } from "@/features/task/stores/task";
import {
  buildTodoUpsertRequest,
  createTodoDetailForm,
  type TodoDetailForm,
} from "@/features/task/utils/taskForm";
import type { ErrorResponse } from "@/shared/types/error";

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
  const todoStore = useTodoStore();
  const userStore = useUserStore();

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
  const fullName = computed(() =>
    todoForm.userId > 0 ? `ユーザーID: ${todoForm.userId}` : "対象ユーザーなし"
  );

  /** 取得・保存処理が表示したメッセージを次の画面操作前に破棄する。 */
  const clearMessages = (): void => {
    errorMessages.value = [];
    loadError.value = "";
    successMessage.value = "";
  };

  /** Todoフォームを新規登録用の既定値へ戻す。 */
  const resetForm = (): void => {
    Object.assign(todoForm, createTodoDetailForm());
  };

  /** Todo詳細をAPIから取得し、編集フォームへ復元する。 */
  const loadTodoDetail = async (): Promise<void> => {
    resetForm();
    clearMessages();
    if (normalizedTodoId.value === 0) {
      return;
    }

    try {
      const detail = await todoStore.findTodoDetail(normalizedTodoId.value);
      Object.assign(todoForm, createTodoDetailForm(detail));
    } catch (_error: unknown) {
      loadError.value =
        "Todo情報を取得できませんでした。Todo一覧から開き直してください。";
    }
  };

  /** 新規フォームを初期化し、編集フォームは取得時の内容へ戻す。 */
  const clearForm = async (): Promise<void> => {
    await loadTodoDetail();
  };

  const showConfirm = (): void => {
    if (!canWriteTodo.value) {
      errorMessages.value = ["Todoを更新するpermissionがありません。"];
      return;
    }
    isShowConfirm.value = true;
  };

  const closeConfirm = (): void => {
    isShowConfirm.value = false;
  };

  /** 確認済みのTodoを新規登録または更新する。 */
  const confirmSubmit = async (): Promise<void> => {
    closeConfirm();
    errorMessages.value = [];
    successMessage.value = "";
    if (!canWriteTodo.value) {
      errorMessages.value = ["Todoを更新するpermissionがありません。"];
      return;
    }
    const isUpdate = todoForm.todoId > 0;
    const payload = buildTodoUpsertRequest(todoForm);

    isSubmitting.value = true;
    try {
      const response = await todoStore.upsertTodoInfo(payload);
      if (!response.ok) {
        const errorResponse = (await response.json()) as ErrorResponse;
        errorMessages.value = (errorResponse.fieldErrors ?? []).map(
          (fieldError) => fieldError.message
        );
        if (errorMessages.value.length === 0) {
          errorMessages.value = ["Todo情報を保存できませんでした。"];
        }
        return;
      }

      successMessage.value = `Todoを${isUpdate ? "更新" : "登録"}しました。`;
      if (!isUpdate) {
        resetForm();
      }
    } catch (_error: unknown) {
      errorMessages.value = ["Todo情報を保存できませんでした。"];
    } finally {
      isSubmitting.value = false;
    }
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
