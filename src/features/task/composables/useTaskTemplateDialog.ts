import { computed, ref, toValue, watch } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";

import type { ProjectMember, TaskDetail, TaskStatus } from "@/features/project/types/project";
import { useTaskTemplates } from "@/features/task/composables/useTaskTemplates";
import { buildProjectMemberOptions } from "@/features/project/utils/projectMember";
import {
  buildTaskStatusCodeOptions,
  buildTaskStatusIdOptions,
} from "@/features/task/utils/taskFormOptions";

/** `useTaskTemplateDialog`へ渡すBoard側の状態と通知先。 */
export interface TaskTemplateDialogSource {
  projectId: Readonly<Ref<number>>;
  members: MaybeRefOrGetter<readonly ProjectMember[]>;
  statuses: MaybeRefOrGetter<readonly TaskStatus[]>;
  /**
   * 適用時の担当者をこのaccountだけに限定する場合のID（MEMBERの本人）。nullまたは未指定なら全参加者から選べる。
   */
  restrictedAssigneeAccountId?: MaybeRefOrGetter<number | null>;
  /** TemplateからTaskを作成したときの通知先。親BoardはTaskを再取得する。 */
  onTaskCreated: (task: TaskDetail) => void;
}

/**
 * Project BoardのTask Template Dialogの開閉と、Template適用・archiveのDialog操作を提供する。
 * Template一覧の取得・編集・適用APIは`useTaskTemplates`が担当する。
 */
export const useTaskTemplateDialog = (source: TaskTemplateDialogSource) => {
  const templates = useTaskTemplates(source.projectId);
  const { applyAssigneeAccountId, applyTemplate, archiveTemplate, loadTemplates, selectedTemplate } = templates;
  const restrictedAssigneeAccountId = computed<number | null>(() =>
    toValue(source.restrictedAssigneeAccountId ?? null)
  );

  /** Template一覧Dialogを開いている場合はtrue。 */
  const isOpen = ref<boolean>(false);
  /** archive確認Dialogを開いている場合はtrue。 */
  const isArchiveConfirmOpen = ref<boolean>(false);

  // Backendは停止中アカウントをTaskテンプレートの担当者に指定できないため、ACTIVEな参加者だけを候補にする。
  const memberOptions = computed(() => buildProjectMemberOptions(toValue(source.members)));
  /** 適用時の担当者候補。担当者を限定する場合（MEMBER）はその本人だけ。Template編集の既定担当者は`memberOptions`を使う。 */
  const applyAssigneeOptions = computed(() =>
    restrictedAssigneeAccountId.value === null
      ? memberOptions.value
      : memberOptions.value.filter((option) => option.value === restrictedAssigneeAccountId.value)
  );
  // Backendは完了列へのTemplate適用を409（TASK_TEMPLATE_NOT_APPLICABLE）で拒否するため、未完了の列だけを候補にする。
  const applyStatusOptions = computed(() => buildTaskStatusIdOptions(toValue(source.statuses), true));
  const statusCodeOptions = computed(() => buildTaskStatusCodeOptions(toValue(source.statuses)));

  // Templateを選び直すと`useTaskTemplates#selectTemplate`が担当者をnull（Template既定値）へ戻す。
  // 担当者を限定する場合は、既定担当が他人のTemplateでも403にならないよう、選んだ直後に本人を入れ直す。
  watch(
    [() => selectedTemplate.value?.taskTemplateId, restrictedAssigneeAccountId],
    () => {
      if (restrictedAssigneeAccountId.value !== null && selectedTemplate.value) {
        applyAssigneeAccountId.value = restrictedAssigneeAccountId.value;
      }
    },
    { immediate: true }
  );

  /** Dialogを開き、本人所有Templateの最新一覧を取得する。 */
  const open = async (): Promise<void> => {
    isOpen.value = true;
    await loadTemplates();
  };

  /** 選択TemplateからTaskを作成し、成功した場合だけDialogを閉じて親Boardへ通知する。 */
  const applySelectedTemplate = async (): Promise<void> => {
    const created = await applyTemplate();
    if (created === null) {
      return;
    }
    isOpen.value = false;
    source.onTaskCreated(created);
  };

  /** archive確認後にTemplateを論理削除し、確認Dialogを閉じる。 */
  const confirmArchive = async (): Promise<void> => {
    await archiveTemplate();
    isArchiveConfirmOpen.value = false;
  };

  return {
    ...templates,
    applyAssigneeOptions,
    applySelectedTemplate,
    applyStatusOptions,
    confirmArchive,
    isArchiveConfirmOpen,
    isOpen,
    memberOptions,
    open,
    statusCodeOptions,
  };
};
