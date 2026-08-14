import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectApi, {
  ProjectApiError,
} from "@/features/project/api/projectApi";
import type {
  ProjectDetail,
  TaskBoard,
  TaskCreateRequest,
  TaskDetail,
  TaskPriority,
  TaskUpdateRequest,
} from "@/features/project/types/project";
import ProjectTaskApi, {
  ProjectTaskApiError,
} from "@/features/task/api/projectTaskApi";

interface TaskForm {
  taskId: number | null;
  taskStatusId: number | null;
  title: string;
  detail: string;
  dateFrom: string;
  dateTo: string;
  assigneeAccountId: number | null;
  priority: TaskPriority;
  version: number | null;
}

interface SelectOption<TValue> {
  title: string;
  value: TValue;
}

/** 編集前の値を共有しない、新しいTaskフォームを作る。 */
const createEmptyTaskForm = (): TaskForm => ({
  taskId: null,
  taskStatusId: null,
  title: "",
  detail: "",
  dateFrom: "",
  dateTo: "",
  assigneeAccountId: null,
  priority: 2,
  version: null,
});

/** ブラウザーのローカル日付をdate input用のyyyy-MM-ddへ変換する。 */
const getToday = (): string => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

/** Project Boardの読込、Task詳細Dialog、登録・更新と競合回復を管理する。 */
export const useTaskBoardPage = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const board = ref<TaskBoard | null>(null);
  const errorMessages = ref<string[]>([]);
  const form = ref<TaskForm>(createEmptyTaskForm());
  const isEditorOpen = ref(false);
  const isLoading = ref(false);
  const isLoadingTask = ref(false);
  const isSaving = ref(false);
  const project = ref<ProjectDetail | null>(null);
  const successMessage = ref("");

  const projectId = computed(() => {
    const value = Array.isArray(route.params.projectId)
      ? route.params.projectId[0]
      : route.params.projectId;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  });

  const isProjectActive = computed(() => project.value?.status === "ACTIVE");
  const canCreateTask = computed(
    () => userStore.hasPermission("TASK_CREATE") && isProjectActive.value
  );
  const canUpdateTask = computed(
    () => userStore.hasPermission("TASK_UPDATE") && isProjectActive.value
  );
  const isEditing = computed(() => form.value.taskId !== null);
  const isReadonly = computed(() => isEditing.value && !canUpdateTask.value);
  const canSave = computed(
    () =>
      !isSaving.value &&
      !isReadonly.value &&
      (isEditing.value ? canUpdateTask.value : canCreateTask.value)
  );

  const statusOptions = computed<SelectOption<number>[]>(() =>
    (project.value?.taskStatuses ?? []).map((status) => ({
      title: status.name,
      value: status.taskStatusId,
    }))
  );

  const memberOptions = computed<SelectOption<number>[]>(() => {
    const currentMember = project.value?.members.find(
      (member) => member.accountId === userStore.memberId
    );
    const canAssignAnyMember =
      isReadonly.value ||
      userStore.hasRole("SYSTEM_ADMIN") ||
      currentMember?.projectRole === "OWNER" ||
      currentMember?.projectRole === "MANAGER";
    return (project.value?.members ?? [])
      .filter(
        (member) => canAssignAnyMember || member.accountId === userStore.memberId
      )
      .map((member) => ({
        title: `アカウントID: ${member.accountId}（${member.projectRole}）`,
        value: member.accountId,
      }));
  });

  const priorityOptions: SelectOption<TaskPriority>[] = [
    { title: "高", value: 1 },
    { title: "中", value: 2 },
    { title: "低", value: 3 },
  ];

  /** Project詳細とBoardを同じ画面スナップショットとして取得する。 */
  const loadBoardData = async (): Promise<void> => {
    if (projectId.value === null) {
      errorMessages.value = ["Project IDが不正です。"];
      return;
    }
    const [projectValue, boardValue] = await Promise.all([
      ProjectApi.getProject(projectId.value),
      ProjectApi.getTaskBoard(projectId.value),
    ]);
    project.value = projectValue;
    board.value = boardValue;
  };

  /** 画面初期表示に必要なProject詳細とBoardを取得する。 */
  const initialize = async (): Promise<void> => {
    if (isLoading.value) {
      return;
    }
    isLoading.value = true;
    errorMessages.value = [];
    try {
      await loadBoardData();
    } catch (error: unknown) {
      await handleApiError(error, "Project Boardを取得できませんでした。");
    } finally {
      isLoading.value = false;
    }
  };

  /** 選択列を初期値にしてTask新規登録Dialogを開く。 */
  const openTaskCreator = (taskStatusId?: number): void => {
    errorMessages.value = [];
    successMessage.value = "";
    if (!canCreateTask.value) {
      errorMessages.value = ["Taskを登録するpermissionがありません。"];
      return;
    }
    const today = getToday();
    form.value = {
      ...createEmptyTaskForm(),
      taskStatusId:
        taskStatusId ?? project.value?.taskStatuses[0]?.taskStatusId ?? null,
      assigneeAccountId:
        memberOptions.value.find((option) => option.value === userStore.memberId)
          ?.value ?? memberOptions.value[0]?.value ?? null,
      dateFrom: today,
      dateTo: today,
    };
    isEditorOpen.value = true;
  };

  /** 最新versionを取得してTask参照・編集Dialogを開く。 */
  const openTaskEditor = async (taskId: number): Promise<void> => {
    if (projectId.value === null || isLoadingTask.value) {
      return;
    }
    isLoadingTask.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      const task = await ProjectTaskApi.getTask(projectId.value, taskId);
      form.value = buildTaskForm(task);
      isEditorOpen.value = true;
    } catch (error: unknown) {
      await handleApiError(error, "Task詳細を取得できませんでした。");
    } finally {
      isLoadingTask.value = false;
    }
  };

  /** APIのTask詳細を、Dialogが独立して編集できるフォームへ変換する。 */
  const buildTaskForm = (task: TaskDetail): TaskForm => ({
    taskId: task.taskId,
    taskStatusId: task.taskStatusId,
    title: task.title,
    detail: task.detail,
    dateFrom: task.dateFrom,
    dateTo: task.dateTo,
    assigneeAccountId: task.assigneeAccountId,
    priority: task.priority,
    version: task.version,
  });

  /** 保存中でない場合に入力値を破棄してTask Dialogを閉じる。 */
  const closeTaskEditor = (): void => {
    if (isSaving.value) {
      return;
    }
    closeTaskEditorAfterSaving();
  };

  /** 保存成功・競合時に、保存中でもTask Dialogの状態を破棄する。 */
  const closeTaskEditorAfterSaving = (): void => {
    isEditorOpen.value = false;
    form.value = createEmptyTaskForm();
  };

  /** Taskフォームの必須項目と日付順序をBackend送信前に検証する。 */
  const validateForm = (): boolean => {
    const messages: string[] = [];
    if (form.value.title.trim().length === 0) {
      messages.push("タイトルを入力してください。");
    }
    if (form.value.detail.trim().length === 0) {
      messages.push("詳細を入力してください。");
    }
    if (!form.value.dateFrom || !form.value.dateTo) {
      messages.push("開始日と終了日を入力してください。");
    } else if (form.value.dateFrom > form.value.dateTo) {
      messages.push("終了日は開始日以降にしてください。");
    }
    if (form.value.assigneeAccountId === null) {
      messages.push("担当者を選択してください。");
    }
    if (!isEditing.value && form.value.taskStatusId === null) {
      messages.push("登録先の列を選択してください。");
    }
    errorMessages.value = messages;
    return messages.length === 0;
  };

  /** 新規登録用Requestを、検証済みフォームから組み立てる。 */
  const buildTaskCreateRequest = (): TaskCreateRequest => ({
    title: form.value.title.trim(),
    detail: form.value.detail.trim(),
    dateFrom: form.value.dateFrom,
    dateTo: form.value.dateTo,
    assigneeAccountId: form.value.assigneeAccountId as number,
    taskStatusId: form.value.taskStatusId as number,
    priority: form.value.priority,
  });

  /** 更新用Requestを、検証済みフォームと詳細取得時点のversionから組み立てる。 */
  const buildTaskUpdateRequest = (): TaskUpdateRequest => ({
    title: form.value.title.trim(),
    detail: form.value.detail.trim(),
    dateFrom: form.value.dateFrom,
    dateTo: form.value.dateTo,
    assigneeAccountId: form.value.assigneeAccountId as number,
    priority: form.value.priority,
    version: form.value.version as number,
  });

  /** Taskを登録または更新し、成功後にBackend確定済みBoardを再取得する。 */
  const saveTask = async (): Promise<void> => {
    if (isSaving.value || !canSave.value || !validateForm() || projectId.value === null) {
      return;
    }
    const taskId = form.value.taskId;
    isSaving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      if (taskId === null) {
        await ProjectTaskApi.createTask(
          projectId.value,
          buildTaskCreateRequest()
        );
        successMessage.value = "Taskを登録しました。";
      } else {
        await ProjectTaskApi.updateTask(
          projectId.value,
          taskId,
          buildTaskUpdateRequest()
        );
        successMessage.value = "Taskを更新しました。";
      }
      closeTaskEditorAfterSaving();
      await loadBoardData();
    } catch (error: unknown) {
      await handleApiError(error, "Taskを保存できませんでした。");
      if (error instanceof ProjectTaskApiError && error.status === 409) {
        closeTaskEditorAfterSaving();
        await reloadBoardAfterConflict();
      }
    } finally {
      isSaving.value = false;
    }
  };

  /** 競合後に最新Boardを取得し、古いversionを画面へ残さない。 */
  const reloadBoardAfterConflict = async (): Promise<void> => {
    try {
      await loadBoardData();
    } catch (_error: unknown) {
      errorMessages.value.push("最新のProject Boardを再取得できませんでした。");
    }
  };

  /** Project・Task APIのstatusと項目エラーを画面動作へ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (!(error instanceof ProjectApiError) && !(error instanceof ProjectTaskApiError)) {
      errorMessages.value = ["Backendへ接続できませんでした。"];
      return;
    }
    if (error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    if (error.status === 403) {
      errorMessages.value = ["この操作を実行するpermissionがありません。"];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = ["対象のProjectまたはTaskが見つかりません。"];
      return;
    }
    const fieldMessages = (error.errorResponse?.fieldErrors ?? []).map(
      (fieldError) => fieldError.message
    );
    errorMessages.value = fieldMessages.length > 0 ? fieldMessages : [fallbackMessage];
  };

  return {
    board,
    canCreateTask,
    canSave,
    closeTaskEditor,
    errorMessages,
    form,
    initialize,
    isEditorOpen,
    isLoading,
    isLoadingTask,
    isReadonly,
    isSaving,
    memberOptions,
    openTaskCreator,
    openTaskEditor,
    priorityOptions,
    project,
    saveTask,
    statusOptions,
    successMessage,
  };
};
