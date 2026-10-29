import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionExpiry } from "@/features/auth/composables/useSessionExpiry";
import { useUserStore } from "@/features/auth/stores/user";
import ProjectTemplateApi, {
  ProjectTemplateApiError,
} from "@/features/project/api/projectTemplateApi";
import {
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  PROJECT_TEMPLATE_NAME_MAX_LENGTH,
} from "@/features/project/constants/projectLimits";
import type {
  ProjectTemplate,
  ProjectTemplateMemberMappingRequest,
  ProjectTemplateSummary,
  ProjectTemplateUpdateRequest,
} from "@/features/project/types/projectTemplate";
import {
  PROJECT_RECOVERY_PRIORITY_STATUSES,
  PROJECT_TEMPLATE_ERROR_CODES,
} from "@/features/project/utils/apiErrors";
import { validateProjectKey } from "@/features/project/utils/projectForm";
import { isValidLocalDateInput } from "@/features/project/utils/projectTemplateDate";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import {
  hasApiFieldError,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";
import { getBusinessToday } from "@/shared/utils/businessDate";
import { createDataAttributeSelector, focusFirstEnabledElement } from "@/shared/utils/focus";

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

/**
 * 画面の部品に付ける`data-project-template-control`属性の値。
 * `ProjectTemplatePage.vue`はこの値で属性を付け、`useProjectTemplatePage`は操作の後に同じ値で部品を探してフォーカスを戻す。
 * 更新中は部品をdisabledにし、編集の開始・終了では部品自体が入れ替わるため、そのままではフォーカスがbodyへ外れる。
 */
export const PROJECT_TEMPLATE_CONTROL = {
  /** 詳細の「編集」ボタン。 */
  editButton: "edit",
  /** 編集フォームの「Template名」入力欄。 */
  editName: "edit-name",
  /** 「Projectを作成してBoardを開く」ボタン。 */
  applyButton: "apply",
} as const;

/**
 * 一覧のTemplateごとのボタンに付ける`data-project-template-control`属性の値を組み立てる。
 *
 * @param projectTemplateId Project Template ID
 * @returns `"template:{projectTemplateId}"`形式の属性値
 */
export const templateItemControlKey = (projectTemplateId: number): string =>
  `template:${projectTemplateId}`;

/** `data-project-template-control`属性の値から、その要素を探すselectorを作る。 */
const buildTemplateControlSelector = createDataAttributeSelector("data-project-template-control");

/**
 * Templateからの作成で、入力内容の誤りを表す409のerror code。Template自体は古くなっていないので、
 * 一覧・詳細を取り直さず、入力（Projectキー・Project名・slotの割当）を残したまま直してもらう。
 * 取り直すと入力がすべて消えるため。
 */
const APPLY_INPUT_ERROR_CODES: ReadonlySet<string> = new Set([
  "PROJECT_KEY_CONFLICT",
  "PROJECT_TEMPLATE_MEMBER_MAPPING_INVALID",
  "PROJECT_TEMPLATE_STRUCTURE_INVALID",
]);

/** 409のResponseのerror codeが、すべて指定の集合に含まれるか（error codeがない場合はfalse）。 */
const hasOnlyErrorCodes = (
  error: ProjectTemplateApiError,
  codes: ReadonlySet<string>
): boolean => {
  const fieldErrors = error.errorResponse?.fieldErrors;
  return (
    Array.isArray(fieldErrors) &&
    fieldErrors.length > 0 &&
    fieldErrors.every(
      (fieldError) =>
        typeof fieldError?.errorCode === "string" && codes.has(fieldError.errorCode)
    )
  );
};

/** version競合（Backendの文言が「再読み込みしてください。」で終わる）を含む409か。 */
const isVersionConflict = (error: ProjectTemplateApiError): boolean =>
  hasApiFieldError(error.errorResponse, "PROJECT_TEMPLATE_VERSION_CONFLICT");

/** 結果のmessageを出す場所。`apply`は「TemplateからProjectを作成」のボタンの上、`page`は画面の上部。 */
type FeedbackTarget = "page" | "apply";

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
  projectStartDate: getBusinessToday(),
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
 * ただし作成の409のうち入力の誤り（`APPLY_INPUT_ERROR_CODES`）は、再取得せず入力を残す。
 */
export const useProjectTemplatePage = () => {
  const router = useRouter();
  const userStore = useUserStore();
  const { expireSession } = useSessionExpiry();

  const templates = ref<ProjectTemplateSummary[]>([]);
  const selectedTemplateId = ref<number | null>(null);
  const selectedTemplate = ref<ProjectTemplate | null>(null);
  const editForm = ref<ProjectTemplateEditForm>(createEmptyEditForm());
  const applyForm = ref<ProjectTemplateApplyForm>(createEmptyApplyForm());
  const errorMessages = ref<string[]>([]);
  const successMessage = ref("");
  const isArchiveConfirmOpen = ref(false);
  const isApplying = ref(false);
  const isArchiving = ref(false);
  const isEditing = ref(false);
  const isLoadingDetail = ref(false);
  const isLoadingList = ref(false);
  const isSaving = ref(false);
  const feedbackTarget = ref<FeedbackTarget>("page");

  const canEditTemplate = computed(() =>
    userStore.hasPermission("PROJECT_UPDATE")
  );
  const canApplyTemplate = computed(() =>
    userStore.hasPermission("PROJECT_CREATE")
  );
  const isMutating = computed(
    () => isApplying.value || isArchiving.value || isSaving.value
  );
  /**
   * 結果のmessageを「TemplateからProjectを作成」のボタンの上に出すか。
   * 作成フォームは画面の中ほどにあり、上部のmessageは作成ボタンを押した位置から見えないことがあるため
   * （幅390pxでは画面の外へ出る）。Templateが消えて作成フォームがないときは上部に出す。
   */
  const isApplyFeedback = computed(
    () => feedbackTarget.value === "apply" && selectedTemplate.value !== null
  );

  /**
   * 操作の後に、候補の部品へフォーカスを戻す（候補は優先順。すべて消えた・disabledのときは動かさない）。
   * isSaving等をfalseへ戻した後に呼ぶ。
   *
   * @param candidates `PROJECT_TEMPLATE_CONTROL`または`templateItemControlKey`の値
   */
  const restoreControlFocus = (candidates: readonly string[]): Promise<void> =>
    focusFirstEnabledElement(candidates.map(buildTemplateControlSelector));

  /** 機能資格不足をpermission不足のbodyなし403と区別する。 */
  const isFeatureNotEntitled = (error: ProjectTemplateApiError): boolean =>
    error.status === 403 &&
    hasApiFieldError(
      error.errorResponse,
      "FEATURE_NOT_ENTITLED",
      "featureCode"
    );

  /** 401ではSession表示を破棄し、保護画面に留まらないようLoginへ戻す。 */
  const handleUnauthorized = async (error: unknown): Promise<boolean> => {
    if (!(error instanceof ProjectTemplateApiError) || error.status !== 401) {
      return false;
    }
    templates.value = [];
    selectedTemplateId.value = null;
    selectedTemplate.value = null;
    editForm.value = createEmptyEditForm();
    applyForm.value = createEmptyApplyForm();
    errorMessages.value = [];
    successMessage.value = "";
    isEditing.value = false;
    isArchiveConfirmOpen.value = false;
    await expireSession();
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
      projectStartDate: getBusinessToday(),
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
    errorMessages.value = [];
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
      await handleReadError(
        error,
        DISPLAY_MESSAGES.project.template.listLoadFailed
      );
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
    errorMessages.value = [];
    try {
      const detail = await ProjectTemplateApi.getOwnTemplate(templateId);
      // 選択変更中に遅いResponseが戻っても、別Templateの詳細へ上書きしない。
      if (selectedTemplateId.value !== templateId) return false;
      selectedTemplate.value = detail;
      synchronizeForms(detail);
      return true;
    } catch (error: unknown) {
      if (error instanceof ProjectTemplateApiError && error.status === 404) {
        const notFoundMessages = [
          DISPLAY_MESSAGES.project.template.resourceNotFound,
        ];
        clearSelection();
        if (await loadTemplates()) {
          errorMessages.value = notFoundMessages;
        }
        return false;
      }
      await handleReadError(
        error,
        DISPLAY_MESSAGES.project.template.detailLoadFailed
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
    feedbackTarget.value = "page";
    await loadSelectedTemplate();
  };

  /** 選択Templateのheader編集をBackend確定値から開始する。 */
  const beginEditing = (): void => {
    if (!selectedTemplate.value || !canEditTemplate.value || isMutating.value) {
      return;
    }
    synchronizeForms(selectedTemplate.value);
    isEditing.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    feedbackTarget.value = "page";
    // 「編集」ボタンは編集フォームに入れ替わって消えるため、フォームの先頭へ移す。
    void restoreControlFocus([PROJECT_TEMPLATE_CONTROL.editName]);
  };

  /** 未送信のheader編集を破棄し、「編集」ボタンへフォーカスを戻す。 */
  const cancelEditing = (): void => {
    isEditing.value = false;
    synchronizeForms(selectedTemplate.value);
    void restoreControlFocus([PROJECT_TEMPLATE_CONTROL.editButton]);
  };

  /** header編集フォームをBackendの文字数契約に合わせて検証する。 */
  const buildUpdateRequest = (): ProjectTemplateUpdateRequest | null => {
    const name = editForm.value.name.trim();
    const description = editForm.value.description.trim();
    if (!name || name.length > PROJECT_TEMPLATE_NAME_MAX_LENGTH) {
      errorMessages.value = [`Template名を1〜${PROJECT_TEMPLATE_NAME_MAX_LENGTH}文字で入力してください。`];
      return null;
    }
    if (description.length > PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH) {
      errorMessages.value = [`説明は${PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH}文字以内で入力してください。`];
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
    errorMessages.value = [];
    successMessage.value = "";
    feedbackTarget.value = "page";
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
        DISPLAY_MESSAGES.project.template.updateFailed
      );
    } finally {
      isSaving.value = false;
    }
    // 保存できた・409で編集を閉じた場合は「編集」ボタンへ、編集フォームが残る失敗ではTemplate名へ戻す。
    await restoreControlFocus([
      PROJECT_TEMPLATE_CONTROL.editName,
      PROJECT_TEMPLATE_CONTROL.editButton,
    ]);
  };

  /** 選択Templateのarchive確認を開く。 */
  const openArchiveConfirm = (): void => {
    if (!selectedTemplate.value || !canEditTemplate.value || isMutating.value) {
      return;
    }
    errorMessages.value = [];
    successMessage.value = "";
    feedbackTarget.value = "page";
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
    errorMessages.value = [];
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
        if (!(await loadSelectedTemplate())) {
          successMessage.value = "";
        }
      }
    } catch (error: unknown) {
      isArchiveConfirmOpen.value = false;
      await handleMutationError(
        error,
        DISPLAY_MESSAGES.project.template.archiveFailed
      );
    } finally {
      isArchiving.value = false;
    }
    // archiveしたTemplateの部品は消えるため、次に表示したTemplateの「編集」か、一覧の先頭へ戻す。
    await restoreControlFocus([
      PROJECT_TEMPLATE_CONTROL.editButton,
      ...templates.value.slice(0, 1).map((candidate) =>
        templateItemControlKey(candidate.projectTemplateId)
      ),
    ]);
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
          errorMessages.value = ["SessionのアカウントIDを確認できません。"];
          return null;
        }
        actorIsOwner = true;
        accountIds.add(userStore.memberId);
        mappings.push({ slotKey: slot.slotKey, accountId: userStore.memberId });
        continue;
      }
      const accountId = parseAccountId(rawAccountId);
      if (accountId === null) {
        errorMessages.value = [
          `${slot.displayName}へ正の整数のアカウントIDを割り当ててください。`,
        ];
        return null;
      }
      if (accountIds.has(accountId)) {
        errorMessages.value = [
          "同じアカウントを複数のmember slotへ割り当てることはできません。",
        ];
        return null;
      }
      accountIds.add(accountId);
      if (slot.projectRole === "OWNER" && accountId === userStore.memberId) {
        actorIsOwner = true;
      }
      mappings.push({ slotKey: slot.slotKey, accountId });
    }
    if (!actorIsOwner) {
      errorMessages.value = [
        "自分のアカウントIDをOWNER slotへ割り当ててください。",
      ];
      return null;
    }
    return mappings;
  };

  /**
   * 適用フォームを検証し、作ったProjectのBoardへ遷移する。
   * 入力チェック・APIのエラーは、作成ボタンの上に出す（`isApplyFeedback`）。
   */
  const applyTemplate = async (): Promise<void> => {
    const template = selectedTemplate.value;
    if (!template || !canApplyTemplate.value || isMutating.value) return;
    feedbackTarget.value = "apply";
    successMessage.value = "";
    const projectKey = applyForm.value.projectKey.trim().toUpperCase();
    const name = applyForm.value.name.trim();
    const projectKeyError = validateProjectKey(projectKey);
    if (projectKeyError) {
      errorMessages.value = [projectKeyError];
      return;
    }
    if (!name || name.length > PROJECT_NAME_MAX_LENGTH) {
      errorMessages.value = [`Project名を1〜${PROJECT_NAME_MAX_LENGTH}文字で入力してください。`];
      return;
    }
    if (!isValidLocalDateInput(applyForm.value.projectStartDate)) {
      errorMessages.value = ["Project開始日を正しく入力してください。"];
      return;
    }
    const memberMappings = buildMemberMappings();
    if (memberMappings === null) return;

    isApplying.value = true;
    errorMessages.value = [];
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
      return;
    } catch (error: unknown) {
      if (
        error instanceof ProjectTemplateApiError &&
        error.status === 409 &&
        hasOnlyErrorCodes(error, APPLY_INPUT_ERROR_CODES)
      ) {
        errorMessages.value = resolveApiErrorMessages(
          error.errorResponse,
          PROJECT_TEMPLATE_ERROR_CODES,
          DISPLAY_MESSAGES.project.template.applyFailed
        );
      } else {
        await handleMutationError(
          error,
          DISPLAY_MESSAGES.project.template.applyFailed
        );
      }
    } finally {
      isApplying.value = false;
    }
    await restoreControlFocus([PROJECT_TEMPLATE_CONTROL.applyButton]);
  };

  /** 参照APIのstatusをSession、permission、公開範囲、業務エラーへ変換する。 */
  async function handleReadError(
    error: unknown,
    fallback: string
  ): Promise<void> {
    if (!(error instanceof ProjectTemplateApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (await handleUnauthorized(error)) return;
    if (error.status === 403) {
      errorMessages.value = [DISPLAY_MESSAGES.project.template.readForbidden];
      return;
    }
    if (error.status === 404) {
      errorMessages.value = [
        DISPLAY_MESSAGES.project.template.resourceNotFound,
      ];
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      PROJECT_TEMPLATE_ERROR_CODES,
      fallback
    );
  }

  /**
   * 404／409後に一覧と選択snapshotを再取得し、回復時点の認証・認可を優先する。
   *
   * @param messagesBeforeReload 操作APIのエラーから作ったmessage
   * @param reloadedMessages 取り直せたときだけ後ろへ添えるmessage（取り直しに失敗したときは添えない）
   */
  async function reloadTemplateAfterConflict(
    messagesBeforeReload: string[],
    reloadedMessages: readonly string[] = []
  ): Promise<void> {
    const currentId = selectedTemplateId.value;
    isLoadingList.value = true;
    try {
      templates.value = await ProjectTemplateApi.findOwnTemplates();
      if (
        currentId === null ||
        !templates.value.some(
          (template) => template.projectTemplateId === currentId
        )
      ) {
        clearSelection();
        errorMessages.value = [...messagesBeforeReload, ...reloadedMessages];
        return;
      }

      isLoadingDetail.value = true;
      const detail = await ProjectTemplateApi.getOwnTemplate(currentId);
      selectedTemplateId.value = currentId;
      selectedTemplate.value = detail;
      synchronizeForms(detail);
      errorMessages.value = [...messagesBeforeReload, ...reloadedMessages];
    } catch (error: unknown) {
      if (
        error instanceof ProjectTemplateApiError &&
        PROJECT_RECOVERY_PRIORITY_STATUSES.has(error.status)
      ) {
        if (error.status === 403) {
          templates.value = [];
          clearSelection();
        } else if (error.status === 404) {
          templates.value = templates.value.filter(
            (template) => template.projectTemplateId !== currentId
          );
          clearSelection();
        }
        await handleReadError(
          error,
          DISPLAY_MESSAGES.project.template.reloadFailed
        );
        return;
      }
      errorMessages.value = [
        ...messagesBeforeReload,
        DISPLAY_MESSAGES.project.template.reloadFailed,
      ];
    } finally {
      isLoadingDetail.value = false;
      isLoadingList.value = false;
    }
  }

  /** 更新系APIのstatusとcodeを処理し、404／409では古いdraftを破棄して再取得する。 */
  async function handleMutationError(
    error: unknown,
    fallback: string
  ): Promise<void> {
    if (!(error instanceof ProjectTemplateApiError)) {
      errorMessages.value = [DISPLAY_MESSAGES.common.connectionFailed];
      return;
    }
    if (await handleUnauthorized(error)) return;
    if (error.status === 403) {
      errorMessages.value = isFeatureNotEntitled(error)
        ? resolveApiErrorMessages(
            error.errorResponse,
            PROJECT_TEMPLATE_ERROR_CODES,
            fallback
          )
        : [DISPLAY_MESSAGES.project.template.operationForbidden];
      return;
    }
    if (error.status === 404 || error.status === 409) {
      const messages =
        error.status === 404
          ? [DISPLAY_MESSAGES.project.template.resourceNotFound]
          : resolveApiErrorMessages(
              error.errorResponse,
              PROJECT_TEMPLATE_ERROR_CODES,
              fallback
            );
      // version競合のBackendの文言は「再読み込みしてください。」だが、画面はこの後で取り直す。
      // 取り直せたときは、取り直し済みであることを添える（チェックリスト・コメント・Project設定の409と同じ書き方）。
      const reloadedMessages =
        error.status === 409 && isVersionConflict(error)
          ? [DISPLAY_MESSAGES.project.template.conflictReloaded]
          : [];
      isEditing.value = false;
      isArchiveConfirmOpen.value = false;
      selectedTemplate.value = null;
      synchronizeForms(null);
      await reloadTemplateAfterConflict(messages, reloadedMessages);
      return;
    }
    errorMessages.value = resolveApiErrorMessages(
      error.errorResponse,
      PROJECT_TEMPLATE_ERROR_CODES,
      fallback
    );
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
    errorMessages,
    initialize,
    isApplying,
    isArchiveConfirmOpen,
    isArchiving,
    isApplyFeedback,
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
