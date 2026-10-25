import { computed, ref, toValue } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";

import type { ProjectMember, TaskDetail, TaskStatus } from "@/features/project/types/project";
import { useTaskTemplates } from "@/features/task/composables/useTaskTemplates";
import {
  buildProjectMemberOptions,
  buildTaskStatusCodeOptions,
  buildTaskStatusIdOptions,
} from "@/features/task/utils/taskFormOptions";

/** `useTaskTemplateDialog`へ渡すBoard側の状態と通知先。 */
export interface TaskTemplateDialogSource {
  projectId: Readonly<Ref<number>>;
  members: MaybeRefOrGetter<readonly ProjectMember[]>;
  statuses: MaybeRefOrGetter<readonly TaskStatus[]>;
  /** TemplateからTaskを作成したときの通知先。親BoardはTaskを再取得する。 */
  onTaskCreated: (task: TaskDetail) => void;
}

/**
 * Project BoardのTask Template Dialogの開閉と、Template適用・archiveのDialog操作を提供する。
 * Template一覧の取得・編集・適用APIは`useTaskTemplates`が担当する。
 */
export const useTaskTemplateDialog = (source: TaskTemplateDialogSource) => {
  const templates = useTaskTemplates(source.projectId);
  const { applyTemplate, archiveTemplate, loadTemplates } = templates;

  /** Template一覧Dialogを開いている場合はtrue。 */
  const isOpen = ref<boolean>(false);
  /** archive確認Dialogを開いている場合はtrue。 */
  const isArchiveConfirmOpen = ref<boolean>(false);

  const memberOptions = computed(() => buildProjectMemberOptions(toValue(source.members)));
  const statusIdOptions = computed(() => buildTaskStatusIdOptions(toValue(source.statuses)));
  const statusCodeOptions = computed(() => buildTaskStatusCodeOptions(toValue(source.statuses)));

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
    applySelectedTemplate,
    confirmArchive,
    isArchiveConfirmOpen,
    isOpen,
    memberOptions,
    open,
    statusCodeOptions,
    statusIdOptions,
  };
};
