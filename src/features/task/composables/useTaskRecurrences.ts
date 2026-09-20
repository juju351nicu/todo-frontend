import { computed, ref, type Ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import type { TaskPriority } from "@/features/project/types/project";
import TaskRecurrenceApi, {
  TaskRecurrenceApiError,
} from "@/features/task/api/taskRecurrenceApi";
import TaskTemplateApi, {
  TaskTemplateApiError,
} from "@/features/task/api/taskTemplateApi";
import type {
  TaskRecurrence,
  TaskRecurrenceCreateRequest,
  TaskRecurrenceFrequency,
  TaskRecurrenceFromTemplateRequest,
  TaskRecurrenceGeneration,
  TaskRecurrenceUpdateRequest,
  TaskRecurrenceWeekday,
} from "@/features/task/types/taskRecurrence";
import type { TaskTemplate } from "@/features/task/types/taskTemplate";

/** 繰り返し規則の作成元。 */
export type TaskRecurrenceCreationMode = "DIRECT" | "TEMPLATE";

/** 繰り返し規則の作成・更新Dialogが保持する入力値。 */
export interface TaskRecurrenceForm {
  title: string;
  detail: string;
  priority: TaskPriority;
  plannedEffortMinutes: number;
  dueOffsetDays: number;
  assigneeAccountId: number | null;
  taskStatusId: number | null;
  frequency: TaskRecurrenceFrequency;
  intervalCount: number;
  weekdays: TaskRecurrenceWeekday[];
  monthlyDay: number | null;
  firstOccurrenceDate: string;
  endDate: string;
  generationLeadDays: number;
  status: "ACTIVE" | "PAUSED";
  checklistContents: string[];
  version: number;
  taskTemplateId: number | null;
}

/** ブラウザーのローカル日付をdate input用のyyyy-MM-ddへ変換する。 */
const getToday = (): string => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

/** 新規規則用の独立フォームを作る。 */
const createEmptyForm = (
  assigneeAccountId: number | null = null,
  taskStatusId: number | null = null
): TaskRecurrenceForm => ({
  title: "",
  detail: "",
  priority: 2,
  plannedEffortMinutes: 0,
  dueOffsetDays: 0,
  assigneeAccountId,
  taskStatusId,
  frequency: "DAILY",
  intervalCount: 1,
  weekdays: [],
  monthlyDay: null,
  firstOccurrenceDate: getToday(),
  endDate: "",
  generationLeadDays: 0,
  status: "ACTIVE",
  checklistContents: [],
  version: 0,
  taskTemplateId: null,
});

/** API Responseを、参照元と配列を共有しない編集フォームへ変換する。 */
const buildForm = (rule: TaskRecurrence): TaskRecurrenceForm => ({
  title: rule.title,
  detail: rule.detail,
  priority: rule.priority,
  plannedEffortMinutes: rule.plannedEffortMinutes,
  dueOffsetDays: rule.dueOffsetDays,
  assigneeAccountId: rule.assigneeAccountId,
  taskStatusId: rule.taskStatusId,
  frequency: rule.frequency,
  intervalCount: rule.intervalCount,
  weekdays: [...rule.weekdays],
  monthlyDay: rule.monthlyDay,
  firstOccurrenceDate: rule.firstOccurrenceDate,
  endDate: rule.endDate ?? "",
  generationLeadDays: rule.generationLeadDays,
  status: rule.status === "PAUSED" ? "PAUSED" : "ACTIVE",
  checklistContents: rule.checklistItems.map((item) => item.content),
  version: rule.version,
  taskTemplateId: rule.sourceTaskTemplateId,
});

/** 頻度ごとのBackend上限を返す。 */
const maxInterval = (frequency: TaskRecurrenceFrequency): number =>
  ({ DAILY: 365, WEEKLY: 52, MONTHLY: 24 })[frequency];

/** Project内の繰り返し規則CRUD、生成履歴、手動再試行を管理する。 */
export const useTaskRecurrences = (
  projectId: Readonly<Ref<number | null>>
) => {
  const router = useRouter();
  const userStore = useUserStore();

  const rules = ref<TaskRecurrence[]>([]);
  const templates = ref<TaskTemplate[]>([]);
  const selectedRuleId = ref<number | null>(null);
  const generations = ref<TaskRecurrenceGeneration[]>([]);
  const form = ref<TaskRecurrenceForm>(createEmptyForm());
  const creationMode = ref<TaskRecurrenceCreationMode>("DIRECT");
  const isCreating = ref(false);
  const isEditing = ref(false);
  const isLoading = ref(false);
  const isLoadingGenerations = ref(false);
  const isLoadingTemplates = ref(false);
  const isSaving = ref(false);
  const isArchiving = ref(false);
  const retryingGenerationId = ref<number | null>(null);
  const errorMessage = ref("");
  const successMessage = ref("");

  const selectedRule = computed(
    () =>
      rules.value.find(
        (rule) => rule.taskRecurrenceRuleId === selectedRuleId.value
      ) ?? null
  );
  const isMutating = computed(
    () =>
      isSaving.value ||
      isArchiving.value ||
      retryingGenerationId.value !== null
  );

  /** Backend共通ErrorResponseから最初の利用者向けメッセージを取得する。 */
  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (
      error instanceof TaskRecurrenceApiError ||
      error instanceof TaskTemplateApiError
    ) {
      return error.errorResponse?.fieldErrors?.[0]?.message ?? fallback;
    }
    return fallback;
  };

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (
      !(
        error instanceof TaskRecurrenceApiError ||
        error instanceof TaskTemplateApiError
      ) ||
      error.status !== 401
    ) {
      return false;
    }
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** 規則一覧を再取得し、消えた選択と古いdraftを破棄する。 */
  const loadRules = async (): Promise<boolean> => {
    if (projectId.value === null || isLoading.value) return false;
    isLoading.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      rules.value = await TaskRecurrenceApi.findRules(projectId.value);
      if (
        selectedRuleId.value !== null &&
        !rules.value.some(
          (rule) => rule.taskRecurrenceRuleId === selectedRuleId.value
        )
      ) {
        selectedRuleId.value = null;
        generations.value = [];
        isEditing.value = false;
      }
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "繰り返しTask規則を取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /** Template作成モード用に本人所有のactive Task Templateを取得する。 */
  const loadTemplates = async (): Promise<boolean> => {
    if (isLoadingTemplates.value) return false;
    isLoadingTemplates.value = true;
    errorMessage.value = "";
    try {
      templates.value = await TaskTemplateApi.findOwnTemplates();
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "Task Templateを取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoadingTemplates.value = false;
    }
  };

  /** 選択規則の直近100件の生成履歴を取得する。 */
  const loadGenerations = async (): Promise<boolean> => {
    const ruleId = selectedRuleId.value;
    if (
      projectId.value === null ||
      ruleId === null ||
      isLoadingGenerations.value
    ) {
      return false;
    }
    isLoadingGenerations.value = true;
    try {
      generations.value = await TaskRecurrenceApi.findGenerations(
        projectId.value,
        ruleId
      );
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "生成履歴を取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoadingGenerations.value = false;
    }
  };

  /** 一覧から規則を選択し、最新versionの編集draftと生成履歴を準備する。 */
  const selectRule = async (rule: TaskRecurrence): Promise<void> => {
    if (isMutating.value) return;
    selectedRuleId.value = rule.taskRecurrenceRuleId;
    form.value = buildForm(rule);
    isCreating.value = false;
    isEditing.value = false;
    generations.value = [];
    errorMessage.value = "";
    successMessage.value = "";
    await loadGenerations();
  };

  /** 初期担当者・Board列を設定して新規作成フォームを開く。 */
  const beginCreating = (
    assigneeAccountId: number | null,
    taskStatusId: number | null
  ): void => {
    if (isMutating.value) return;
    selectedRuleId.value = null;
    generations.value = [];
    form.value = createEmptyForm(assigneeAccountId, taskStatusId);
    creationMode.value = "DIRECT";
    isCreating.value = true;
    isEditing.value = false;
    errorMessage.value = "";
    successMessage.value = "";
  };

  /** 選択規則のsnapshotを編集可能な独立draftへ戻す。 */
  const beginEditing = (): void => {
    if (selectedRule.value === null || isMutating.value) return;
    form.value = buildForm(selectedRule.value);
    isEditing.value = true;
    errorMessage.value = "";
    successMessage.value = "";
  };

  /** 未送信の作成・編集内容を破棄する。 */
  const cancelForm = (): void => {
    if (isMutating.value) return;
    isCreating.value = false;
    isEditing.value = false;
    form.value = selectedRule.value
      ? buildForm(selectedRule.value)
      : createEmptyForm();
    errorMessage.value = "";
  };

  /** 頻度別条件、anchor、終了日、生成先行日数をBackend送信前に検証する。 */
  const validateSchedule = (firstOccurrenceDate: string): string => {
    const value = form.value;
    if (!firstOccurrenceDate) return "最初の発生日を入力してください。";
    if (isCreating.value && firstOccurrenceDate < getToday()) {
      return "最初の発生日は今日以降にしてください。";
    }
    if (value.endDate && value.endDate < firstOccurrenceDate) {
      return "終了日は最初の発生日以降にしてください。";
    }
    if (
      !Number.isInteger(value.intervalCount) ||
      value.intervalCount < 1 ||
      value.intervalCount > maxInterval(value.frequency)
    ) {
      return `繰り返し間隔を1〜${maxInterval(value.frequency)}で入力してください。`;
    }
    if (value.frequency === "WEEKLY" && value.weekdays.length === 0) {
      return "週次では曜日を1つ以上選択してください。";
    }
    if (
      value.frequency === "MONTHLY" &&
      (value.monthlyDay === null ||
        !Number.isInteger(value.monthlyDay) ||
        value.monthlyDay < 1 ||
        value.monthlyDay > 31)
    ) {
      return "月次の日付を1〜31で入力してください。";
    }
    if (
      !Number.isInteger(value.generationLeadDays) ||
      value.generationLeadDays < 0 ||
      value.generationLeadDays > 90
    ) {
      return "生成先行日数を0〜90日で入力してください。";
    }
    return "";
  };

  /** Task snapshotとchecklistをBackend契約に合わせて検証する。 */
  const validateSnapshot = (): string => {
    const value = form.value;
    const checklist = value.checklistContents.map((content) => content.trim());
    if (!value.title.trim() || value.title.trim().length > 45) {
      return "Taskタイトルを1〜45文字で入力してください。";
    }
    if (!value.detail.trim() || value.detail.trim().length > 1000) {
      return "Task詳細を1〜1000文字で入力してください。";
    }
    if (
      !Number.isSafeInteger(value.plannedEffortMinutes) ||
      value.plannedEffortMinutes < 0
    ) {
      return "予定工数を0分以上の整数で入力してください。";
    }
    if (
      !Number.isInteger(value.dueOffsetDays) ||
      value.dueOffsetDays < 0 ||
      value.dueOffsetDays > 365
    ) {
      return "期限オフセットを0〜365日で入力してください。";
    }
    if (value.assigneeAccountId === null) return "担当者を選択してください。";
    if (value.taskStatusId === null) return "未完了のBoard列を選択してください。";
    if (
      checklist.length > 50 ||
      checklist.some((content) => content.length === 0 || content.length > 255)
    ) {
      return "チェック項目は1〜255文字、最大50件で入力してください。";
    }
    return "";
  };

  /** フォームの頻度に不要な曜日・月次日を除去してschedule部分を組み立てる。 */
  const buildScheduleRequest = () => ({
    frequency: form.value.frequency,
    intervalCount: form.value.intervalCount,
    weekdays: form.value.frequency === "WEEKLY" ? [...form.value.weekdays] : [],
    monthlyDay: form.value.frequency === "MONTHLY" ? form.value.monthlyDay : null,
    endDate: form.value.endDate || null,
    generationLeadDays: form.value.generationLeadDays,
  });

  /** 直接作成・更新で共通のtrim済みTask snapshot Requestを組み立てる。 */
  const buildSnapshotRequest = () => ({
    title: form.value.title.trim(),
    detail: form.value.detail.trim(),
    priority: form.value.priority,
    plannedEffortMinutes: form.value.plannedEffortMinutes,
    dueOffsetDays: form.value.dueOffsetDays,
    assigneeAccountId: form.value.assigneeAccountId as number,
    taskStatusId: form.value.taskStatusId as number,
    checklistItems: form.value.checklistContents.map((content) => ({
      content: content.trim(),
    })),
  });

  /** 直接入力またはTemplate snapshotからACTIVEな繰り返し規則を作成する。 */
  const createRule = async (): Promise<void> => {
    if (projectId.value === null || !isCreating.value || isMutating.value) return;
    const scheduleError = validateSchedule(form.value.firstOccurrenceDate);
    const snapshotError =
      creationMode.value === "DIRECT" ? validateSnapshot() : "";
    if (scheduleError || snapshotError) {
      errorMessage.value = scheduleError || snapshotError;
      return;
    }
    if (creationMode.value === "TEMPLATE" && form.value.taskTemplateId === null) {
      errorMessage.value = "Task Templateを選択してください。";
      return;
    }

    isSaving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const schedule = buildScheduleRequest();
      let created: TaskRecurrence;
      if (creationMode.value === "DIRECT") {
        const request: TaskRecurrenceCreateRequest = {
          ...buildSnapshotRequest(),
          ...schedule,
          firstOccurrenceDate: form.value.firstOccurrenceDate,
        };
        created = await TaskRecurrenceApi.create(projectId.value, request);
      } else {
        const request: TaskRecurrenceFromTemplateRequest = {
          taskTemplateId: form.value.taskTemplateId as number,
          assigneeAccountId: form.value.assigneeAccountId,
          taskStatusId: form.value.taskStatusId,
          ...schedule,
          firstOccurrenceDate: form.value.firstOccurrenceDate,
        };
        created = await TaskRecurrenceApi.createFromTemplate(
          projectId.value,
          request
        );
      }
      rules.value = [...rules.value, created].sort(
        (left, right) => left.taskRecurrenceRuleId - right.taskRecurrenceRuleId
      );
      selectedRuleId.value = created.taskRecurrenceRuleId;
      form.value = buildForm(created);
      generations.value = [];
      isCreating.value = false;
      successMessage.value = "繰り返しTask規則を作成しました。";
    } catch (error: unknown) {
      await handleMutationError(error, "繰り返しTask規則を作成できませんでした。", false);
    } finally {
      isSaving.value = false;
    }
  };

  /** 選択規則を取得時点version付きで全置換し、pause／resumeも確定する。 */
  const saveRule = async (): Promise<void> => {
    const rule = selectedRule.value;
    if (projectId.value === null || rule === null || !isEditing.value || isMutating.value) {
      return;
    }
    const scheduleError = validateSchedule(rule.firstOccurrenceDate);
    const snapshotError = validateSnapshot();
    if (scheduleError || snapshotError) {
      errorMessage.value = scheduleError || snapshotError;
      return;
    }

    isSaving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const request: TaskRecurrenceUpdateRequest = {
        ...buildSnapshotRequest(),
        ...buildScheduleRequest(),
        status: form.value.status,
        version: form.value.version,
      };
      const updated = await TaskRecurrenceApi.update(
        projectId.value,
        rule.taskRecurrenceRuleId,
        request
      );
      rules.value = rules.value.map((candidate) =>
        candidate.taskRecurrenceRuleId === updated.taskRecurrenceRuleId
          ? updated
          : candidate
      );
      form.value = buildForm(updated);
      isEditing.value = false;
      successMessage.value = "繰り返しTask規則を更新しました。";
    } catch (error: unknown) {
      await handleMutationError(error, "繰り返しTask規則を更新できませんでした。", true);
    } finally {
      isSaving.value = false;
    }
  };

  /** 選択規則をversion付きでarchiveし、生成履歴を保持した最新状態へ更新する。 */
  const archiveRule = async (): Promise<void> => {
    const rule = selectedRule.value;
    if (projectId.value === null || rule === null || isMutating.value) return;
    isArchiving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      await TaskRecurrenceApi.archive(
        projectId.value,
        rule.taskRecurrenceRuleId,
        rule.version
      );
      await refreshAfterMutation(rule.taskRecurrenceRuleId);
      successMessage.value = "繰り返しTask規則をアーカイブしました。";
    } catch (error: unknown) {
      await handleMutationError(
        error,
        "繰り返しTask規則をアーカイブできませんでした。",
        true
      );
    } finally {
      isArchiving.value = false;
    }
  };

  /** FAILED生成履歴を最新規則version条件付きで再試行待ちへ戻す。 */
  const retryGeneration = async (
    generation: TaskRecurrenceGeneration
  ): Promise<void> => {
    const rule = selectedRule.value;
    if (
      projectId.value === null ||
      rule === null ||
      generation.status !== "FAILED" ||
      isMutating.value
    ) {
      return;
    }
    retryingGenerationId.value = generation.taskRecurrenceGenerationId;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      await TaskRecurrenceApi.retryGeneration(
        projectId.value,
        rule.taskRecurrenceRuleId,
        generation.taskRecurrenceGenerationId,
        rule.version
      );
      await refreshAfterMutation(rule.taskRecurrenceRuleId);
      successMessage.value = "生成の再試行を受け付けました。";
    } catch (error: unknown) {
      await handleMutationError(error, "生成を再試行できませんでした。", true);
    } finally {
      retryingGenerationId.value = null;
    }
  };

  /** 更新成功後に規則と生成履歴を再取得し、versionを同期する。 */
  const refreshAfterMutation = async (ruleId: number): Promise<void> => {
    if (projectId.value === null) return;
    rules.value = await TaskRecurrenceApi.findRules(projectId.value);
    const latest = rules.value.find(
      (rule) => rule.taskRecurrenceRuleId === ruleId
    );
    if (latest === undefined) {
      selectedRuleId.value = null;
      generations.value = [];
      isEditing.value = false;
      return;
    }
    selectedRuleId.value = latest.taskRecurrenceRuleId;
    form.value = buildForm(latest);
    isEditing.value = false;
    generations.value = await TaskRecurrenceApi.findGenerations(
      projectId.value,
      latest.taskRecurrenceRuleId
    );
  };

  /** 更新系APIの401と404／409に対するSession破棄・最新状態再取得を共通処理する。 */
  async function handleMutationError(
    error: unknown,
    fallback: string,
    recoverStaleState: boolean
  ): Promise<void> {
    if (await handleUnauthorized(error)) return;
    const message = getErrorMessage(error, fallback);
    if (
      recoverStaleState &&
      error instanceof TaskRecurrenceApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      const ruleId = selectedRuleId.value;
      isEditing.value = false;
      try {
        if (ruleId !== null) await refreshAfterMutation(ruleId);
      } catch (_reloadError: unknown) {
        errorMessage.value = `${message} 最新状態も再取得できませんでした。`;
        return;
      }
    }
    errorMessage.value = message;
  }

  return {
    archiveRule,
    beginCreating,
    beginEditing,
    cancelForm,
    createRule,
    creationMode,
    errorMessage,
    form,
    generations,
    isArchiving,
    isCreating,
    isEditing,
    isLoading,
    isLoadingGenerations,
    isLoadingTemplates,
    isMutating,
    isSaving,
    loadGenerations,
    loadRules,
    loadTemplates,
    retryGeneration,
    retryingGenerationId,
    rules,
    saveRule,
    selectRule,
    selectedRule,
    successMessage,
    templates,
  };
};
