import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
import type {
  ProjectTemplate,
  ProjectTemplateMemberMappingRequest,
  ProjectTemplateSummary,
  ProjectTemplateUpdateRequest,
} from "@/features/project/types/projectTemplate";
import {
  isValidLocalDateInput,
  toLocalDateInputValue,
} from "@/features/project/utils/projectTemplateDate";

/** Project Template header編集フォーム。 */
export interface ProjectTemplateEditForm {
  name: string;
  description: string;
  version: number;
}

/** Project Template適用時のProject情報とslot mappingフォーム。 */
export interface ProjectTemplateApplyForm {
  projectKey: string;
  name: string;
  projectStartDate: string;
  memberMappings: Record<string, number | string | null>;
}

/** Project Template未選択時にも共有参照を持たない空編集フォームを作る。 */
const createEmptyEditForm = (): ProjectTemplateEditForm => ({
  name: "",
  description: "",
  version: 0,
});

/** Project Template未選択時の空適用フォームを作る。 */
const createEmptyApplyForm = (): ProjectTemplateApplyForm => ({
  projectKey: "",
  name: "",
  projectStartDate: toLocalDateInputValue(),
  memberMappings: {},
});

/** number inputの値を正の安全なaccount IDへ変換する。 */
const parseAccountId = (value: number | string | null): number | null => {
  if (value === null || value === "") return null;
  const accountId = Number(value);
  return Number.isSafeInteger(accountId) && accountId > 0 ? accountId : null;
};

/** 更新Responseから一覧用headerを作り、snapshot配列を一覧stateへ重複保持しない。 */
const toSummary = (template: ProjectTemplate): ProjectTemplateSummary => ({
  projectTemplateId: template.projectTemplateId,
  name: template.name,
  description: template.description,
  baseDate: template.baseDate,
  sourceProjectId: template.sourceProjectId,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
  version: template.version,
});

/**
 * 本人所有Project Templateの一覧・詳細・更新・archive・Project適用を1画面で管理する。
 * 401ではSessionを破棄し、404／409では古いsnapshotとversionを破棄してBackendから再取得する。
 */
export const useProjectTemplatePage = () => {
  const router = useRouter();
  const userStore = useUserStore();

  const templates = ref<ProjectTemplateSummary[]>([]);
  const selectedTemplateId = ref<number | null>(null);
  const selectedTemplate = ref<ProjectTemplate | null>(null);
  const editForm = ref<ProjectTemplateEditForm>(createEmptyEditForm());
  const applyForm = ref<ProjectTemplateApplyForm>(createEmptyApplyForm());
  const errorMessage = ref("");
  const successMessage = ref("");
  const isArchiveConfirmOpen = ref(false);
  const isApplying = ref(false);
  const isArchiving = ref(false);
  const isEditing = ref(false);
  const isLoadingDetail = ref(false);
  const isLoadingList = ref(false);
  const isSaving = ref(false);

  const canEditTemplate = computed(() =>
    userStore.hasPermission("PROJECT_UPDATE")
  );
  const canApplyTemplate = computed(() =>
    userStore.hasPermission("PROJECT_CREATE")
  );
  const isMutating = computed(
    () => isApplying.value || isArchiving.value || isSaving.value
  );

  /** Backend共通ErrorResponseから最初の利用者向けメッセージを取得する。 */
  const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof ProjectTemplateApiError
      ? error.errorResponse?.fieldErrors?.[0]?.message ?? fallback
      : fallback;

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof ProjectTemplateApiError) || error.status !== 401) {
      return false;
    }
    userStore.clearSession();
    await router.push({ name: "Login" });
    return true;
  };

  /** 選択中のProject Template詳細から編集・適用フォームを新しく作り直す。 */
  const synchronizeForms = (template: ProjectTemplate | null): void => {
    if (template === null) {
      editForm.value = createEmptyEditForm();
      applyForm.value = createEmptyApplyForm();
      return;
    }
    editForm.value = {
      name: template.name,
      description: template.description ?? "",
      version: template.version,
    };
    applyForm.value = {
      projectKey: "",
      name: template.name,
      projectStartDate: toLocalDateInputValue(),
      memberMappings: Object.fromEntries(
        template.memberSlots.map((slot) => [
          slot.slotKey,
          slot.slotKey === "OWNER_1" ? userStore.memberId : null,
        ])
      ),
    };
  };

  /** 選択と未送信draftを破棄する。 */
  const clearSelection = (): void => {
    selectedTemplateId.value = null;
    selectedTemplate.value = null;
    isEditing.value = false;
    isArchiveConfirmOpen.value = false;
    synchronizeForms(null);
  };

  /** 本人所有active Template headerを再取得し、消えた選択を破棄する。 */
  const loadTemplates = async (): Promise<boolean> => {
    if (isLoadingList.value) return false;
    isLoadingList.value = true;
    errorMessage.value = "";
    try {
      templates.value = await ProjectTemplateApi.findOwnTemplates();
      if (
        selectedTemplateId.value !== null &&
        !templates.value.some(
          (template) =>
            template.projectTemplateId === selectedTemplateId.value
        )
      ) {
        clearSelection();
      }
      return true;
    } catch (error: unknown) {
      if (!(await handleUnauthorized(error))) {
        errorMessage.value = getErrorMessage(
          error,
          "Project Template一覧を取得できませんでした。"
        );
      }
      return false;
    } finally {
      isLoadingList.value = false;
    }
  };

  /** 選択IDのsnapshot全体を取得し、古いフォームをBackend確定値で置換する。 */
  const loadSelectedTemplate = async (): Promise<boolean> => {
    const templateId = selectedTemplateId.value;
    if (templateId === null || isLoadingDetail.value) return false;
    isLoadingDetail.value = true;
    errorMessage.value = "";
    try {
      const detail = await ProjectTemplateApi.getOwnTemplate(templateId);
      // 選択変更中に遅いResponseが戻っても、別Templateの詳細へ上書きしない。
      if (selectedTemplateId.value !== templateId) return false;
      selectedTemplate.value = detail;
      synchronizeForms(detail);
      return true;
    } catch (error: unknown) {
      if (await handleUnauthorized(error)) return false;
      if (
        error instanceof ProjectTemplateApiError &&
        error.status === 404
      ) {
        clearSelection();
        await loadTemplates();
      }
      errorMessage.value = getErrorMessage(
        error,
        "Project Template詳細を取得できませんでした。"
      );
      return false;
    } finally {
      isLoadingDetail.value = false;
    }
  };

  /** 初期一覧を取得し、存在する場合は先頭Templateの詳細まで表示する。 */
  const initialize = async (): Promise<void> => {
    if (!(await loadTemplates()) || templates.value.length === 0) return;
    await selectTemplate(templates.value[0]);
  };

  /** 一覧からTemplateを選択し、snapshot詳細をBackendから取得する。 */
  const selectTemplate = async (
    template: ProjectTemplateSummary
  ): Promise<void> => {
    if (isMutating.value || isLoadingDetail.value) return;
    selectedTemplateId.value = template.projectTemplateId;
    selectedTemplate.value = null;
    isEditing.value = false;
    successMessage.value = "";
    await loadSelectedTemplate();
  };

  /** 選択Templateのheader編集をBackend確定値から開始する。 */
  const beginEditing = (): void => {
    if (!selectedTemplate.value || !canEditTemplate.value || isMutating.value) {
      return;
    }
    synchronizeForms(selectedTemplate.value);
    isEditing.value = true;
    errorMessage.value = "";
    successMessage.value = "";
  };

  /** 未送信のheader編集を破棄する。 */
  const cancelEditing = (): void => {
    isEditing.value = false;
    synchronizeForms(selectedTemplate.value);
  };

  /** header編集フォームをBackendの文字数契約に合わせて検証する。 */
  const buildUpdateRequest = (): ProjectTemplateUpdateRequest | null => {
    const name = editForm.value.name.trim();
    const description = editForm.value.description.trim();
    if (!name || name.length > 100) {
      errorMessage.value = "Template名を1〜100文字で入力してください。";
      return null;
    }
    if (description.length > 2000) {
      errorMessage.value = "説明は2000文字以内で入力してください。";
      return null;
    }
    return {
      name,
      description: description || null,
      version: editForm.value.version,
    };
  };

  /** 選択Templateの名称・説明を取得時点versionで更新する。 */
  const saveTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (!template || !canEditTemplate.value || isMutating.value) return;
    const request = buildUpdateRequest();
    if (request === null) return;
    isSaving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const updated = await ProjectTemplateApi.update(
        template.projectTemplateId,
        request
      );
      selectedTemplate.value = updated;
      templates.value = templates.value.map((candidate) =>
        candidate.projectTemplateId === updated.projectTemplateId
          ? toSummary(updated)
          : candidate
      );
      isEditing.value = false;
      synchronizeForms(updated);
      successMessage.value = "Project Templateを更新しました。";
    } catch (error: unknown) {
      await handleMutationError(
        error,
        "Project Templateを更新できませんでした。"
      );
    } finally {
      isSaving.value = false;
    }
  };

  /** 選択Templateのarchive確認を開く。 */
  const openArchiveConfirm = (): void => {
    if (!selectedTemplate.value || !canEditTemplate.value || isMutating.value) {
      return;
    }
    errorMessage.value = "";
    successMessage.value = "";
    isArchiveConfirmOpen.value = true;
  };

  /** archive処理中でなければ確認Dialogを閉じる。 */
  const closeArchiveConfirm = (): void => {
    if (!isArchiving.value) isArchiveConfirmOpen.value = false;
  };

  /** 選択Templateをversion条件付きでarchiveし、active一覧から除外する。 */
  const archiveTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (!template || !canEditTemplate.value || isMutating.value) return;
    isArchiving.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      await ProjectTemplateApi.archive(
        template.projectTemplateId,
        template.version
      );
      templates.value = templates.value.filter(
        (candidate) =>
          candidate.projectTemplateId !== template.projectTemplateId
      );
      clearSelection();
      successMessage.value = "Project Templateをアーカイブしました。";
      if (templates.value.length > 0) {
        selectedTemplateId.value = templates.value[0].projectTemplateId;
        await loadSelectedTemplate();
        successMessage.value = "Project Templateをアーカイブしました。";
      }
    } catch (error: unknown) {
      isArchiveConfirmOpen.value = false;
      await handleMutationError(
        error,
        "Project Templateをアーカイブできませんでした。"
      );
    } finally {
      isArchiving.value = false;
    }
  };

  /** slot mappingを検証し、Backend Requestの配列へ変換する。 */
  const buildMemberMappings = (): ProjectTemplateMemberMappingRequest[] | null => {
    const template = selectedTemplate.value;
    if (template === null) return null;
    const mappings: ProjectTemplateMemberMappingRequest[] = [];
    const accountIds = new Set<number>();
    let actorIsOwner = false;
    for (const slot of template.memberSlots) {
      const rawAccountId = applyForm.value.memberMappings[slot.slotKey] ?? null;
      if ((rawAccountId === null || rawAccountId === "") && slot.slotKey === "OWNER_1") {
        if (userStore.memberId === null) {
          errorMessage.value = "SessionのアカウントIDを確認できません。";
          return null;
        }
        actorIsOwner = true;
        accountIds.add(userStore.memberId);
        mappings.push({ slotKey: slot.slotKey, accountId: userStore.memberId });
        continue;
      }
      const accountId = parseAccountId(rawAccountId);
      if (accountId === null) {
        errorMessage.value = `${slot.displayName}へ正の整数のアカウントIDを割り当ててください。`;
        return null;
      }
      if (accountIds.has(accountId)) {
        errorMessage.value = "同じアカウントを複数のmember slotへ割り当てることはできません。";
        return null;
      }
      accountIds.add(accountId);
      if (slot.projectRole === "OWNER" && accountId === userStore.memberId) {
        actorIsOwner = true;
      }
      mappings.push({ slotKey: slot.slotKey, accountId });
    }
    if (!actorIsOwner) {
      errorMessage.value = "自分のアカウントIDをOWNER slotへ割り当ててください。";
      return null;
    }
    return mappings;
  };

  /** 適用フォームを検証し、生成ProjectのBoardへ遷移できるRequestを組み立てる。 */
  const applyTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (!template || !canApplyTemplate.value || isMutating.value) return;
    const projectKey = applyForm.value.projectKey.trim().toUpperCase();
    const name = applyForm.value.name.trim();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(projectKey) || projectKey.length > 30) {
      errorMessage.value = "Projectキーは30文字以内の大文字英数字をハイフンで区切って入力してください。";
      return;
    }
    if (!name || name.length > 100) {
      errorMessage.value = "Project名を1〜100文字で入力してください。";
      return;
    }
    if (!isValidLocalDateInput(applyForm.value.projectStartDate)) {
      errorMessage.value = "Project開始日を正しく入力してください。";
      return;
    }
    const memberMappings = buildMemberMappings();
    if (memberMappings === null) return;

    isApplying.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    try {
      const created = await ProjectTemplateApi.apply(
        template.projectTemplateId,
        {
          projectKey,
          name,
          projectStartDate: applyForm.value.projectStartDate,
          memberMappings,
        }
      );
      await router.push({
        name: "TaskBoard",
        params: { projectId: created.projectId },
      });
    } catch (error: unknown) {
      await handleMutationError(
        error,
        "Project TemplateからProjectを作成できませんでした。"
      );
    } finally {
      isApplying.value = false;
    }
  };

  /** 更新系APIの401と404／409を処理し、古いversion・mapping draftを残さない。 */
  async function handleMutationError(
    error: unknown,
    fallback: string
  ): Promise<void> {
    if (await handleUnauthorized(error)) return;
    if (
      error instanceof ProjectTemplateApiError &&
      (error.status === 404 || error.status === 409)
    ) {
      const message = getErrorMessage(
        error,
        "Project Templateが変更されています。最新の状態を表示しました。"
      );
      isEditing.value = false;
      isArchiveConfirmOpen.value = false;
      const currentId = selectedTemplateId.value;
      if (await loadTemplates()) {
        if (
          currentId !== null &&
          templates.value.some(
            (template) => template.projectTemplateId === currentId
          )
        ) {
          selectedTemplateId.value = currentId;
          await loadSelectedTemplate();
        }
        errorMessage.value = message;
      }
      return;
    }
    errorMessage.value = getErrorMessage(error, fallback);
  }

  return {
    applyForm,
    applyTemplate,
    archiveTemplate,
    beginEditing,
    canApplyTemplate,
    canEditTemplate,
    cancelEditing,
    closeArchiveConfirm,
    editForm,
    errorMessage,
    initialize,
    isApplying,
    isArchiveConfirmOpen,
    isArchiving,
    isEditing,
    isLoadingDetail,
    isLoadingList,
    isMutating,
    isSaving,
    openArchiveConfirm,
    saveTemplate,
    selectTemplate,
    selectedTemplate,
    successMessage,
    templates,
  };
};
