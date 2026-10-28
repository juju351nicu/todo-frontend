import { computed, ref, toValue } from "vue";
import type { MaybeRefOrGetter, Ref } from "vue";

import type { ProjectMember, TaskStatus } from "@/features/project/types/project";
import type { TaskRecurrenceWeekday } from "@/features/task/types/taskRecurrence";
import { useTaskRecurrences } from "@/features/task/composables/useTaskRecurrences";
import {
  buildProjectMemberOptions,
  resolveProjectMemberDisplayName,
} from "@/features/project/utils/projectMember";
import { buildTaskStatusIdOptions } from "@/features/task/utils/taskFormOptions";
import { formatRecurrenceSource } from "@/features/task/utils/taskRecurrenceDisplay";

/** `useTaskRecurrenceDialog`へ渡すBoard側の状態。 */
export interface TaskRecurrenceDialogSource {
  projectId: Readonly<Ref<number>>;
  members: MaybeRefOrGetter<readonly ProjectMember[]>;
  statuses: MaybeRefOrGetter<readonly TaskStatus[]>;
  /** 規則の更新permissionがある場合はtrue。最終認可はBackendが行う。 */
  canUpdate: MaybeRefOrGetter<boolean>;
  /** ProjectがACTIVEの場合はtrue。archive済みProjectでは規則を変更できない。 */
  projectActive: MaybeRefOrGetter<boolean>;
}

/** 規則を編集できる状態。BLOCKEDは修正して再開するため編集可能にする。 */
const EDITABLE_RULE_STATUSES = ["ACTIVE", "PAUSED", "BLOCKED"] as const;

/**
 * Project Boardの繰り返しTask Dialogの開閉・既定値・操作可否を提供する。
 * 規則の取得・保存・生成履歴は`useTaskRecurrences`が担当し、このcomposableはその結果をDialog操作へつなぐ。
 */
export const useTaskRecurrenceDialog = (source: TaskRecurrenceDialogSource) => {
  const recurrences = useTaskRecurrences(source.projectId);
  const {
    archiveRule,
    beginCreating,
    creationMode,
    form,
    isCreating,
    isEditing,
    loadRules,
    loadTemplates,
    selectedRule,
    templates,
  } = recurrences;

  /** 規則一覧Dialogを開いている場合はtrue。 */
  const isOpen = ref<boolean>(false);
  /** archive確認Dialogを開いている場合はtrue。 */
  const isArchiveConfirmOpen = ref<boolean>(false);

  // Backendは停止中アカウントを繰り返しTaskの担当者・作成者に指定できないため、ACTIVEな参加者だけを候補にする。
  const memberOptions = computed(() => buildProjectMemberOptions(toValue(source.members)));
  // 繰り返しで生成するTaskは未完了として作るため、完了列は選べない。
  const statusOptions = computed(() => buildTaskStatusIdOptions(toValue(source.statuses), true));

  const canChangeRules = computed<boolean>(() => toValue(source.canUpdate) && toValue(source.projectActive));
  /** 選択規則を編集できる場合はtrue。終了・archive済みの規則は編集できない。 */
  const canEditSelected = computed<boolean>(
    () =>
      canChangeRules.value &&
      selectedRule.value !== null &&
      (EDITABLE_RULE_STATUSES as readonly string[]).includes(selectedRule.value.status),
  );
  /**
   * 規則の作成・編集フォームを開いている場合はtrue。
   * 開いている間はエラーを「作成」「更新」ボタンのすぐ上に出す（フォームが長く、Dialog上端のエラーが見えないため）。
   */
  const isFormOpen = computed<boolean>(() => isCreating.value || isEditing.value);
  /** 選択規則をarchiveできる場合はtrue。 */
  const canArchiveSelected = computed<boolean>(
    () => canChangeRules.value && selectedRule.value !== null && selectedRule.value.status !== "ARCHIVED",
  );

  /** Dialogを開き、archive済みを含む最新規則一覧を取得する。 */
  const open = async (): Promise<void> => {
    isOpen.value = true;
    await loadRules();
  };

  /** Projectの先頭memberと先頭の未完了列を既定値にして作成を始める。 */
  const startCreating = (): void => {
    beginCreating(memberOptions.value[0]?.value ?? null, statusOptions.value[0]?.value ?? null);
  };

  /**
   * 作成元を切り替える。Template作成では担当者・列の上書き値を外し、Template一覧を未取得の場合だけ取得する。
   * 直接作成へ戻した場合は、未入力の担当者・列だけ既定値で補う。
   */
  const changeCreationMode = async (value: "DIRECT" | "TEMPLATE" | null): Promise<void> => {
    if (value === null) {
      return;
    }
    creationMode.value = value;
    if (value === "TEMPLATE") {
      form.value.assigneeAccountId = null;
      form.value.taskStatusId = null;
      if (templates.value.length === 0) {
        await loadTemplates();
      }
      return;
    }
    form.value.assigneeAccountId ??= memberOptions.value[0]?.value ?? null;
    form.value.taskStatusId ??= statusOptions.value[0]?.value ?? null;
  };

  /** 週次の発生曜日の選択を切り替える。追加した曜日は配列の末尾へ加える。 */
  const toggleWeekday = (weekday: TaskRecurrenceWeekday): void => {
    const weekdays = form.value.weekdays;
    form.value.weekdays = weekdays.includes(weekday)
      ? weekdays.filter((selected) => selected !== weekday)
      : [...weekdays, weekday];
  };

  /** 選択中の規則の担当者名。参加者から外れたアカウントはIDで示す。規則を選んでいなければ空文字。 */
  const selectedRuleAssigneeDisplayName = computed(() =>
    selectedRule.value === null
      ? ""
      : resolveProjectMemberDisplayName(toValue(source.members), selectedRule.value.assigneeAccountId)
  );

  /**
   * 選択中の規則の作成元。Template一覧はTemplate作成モードを開いたときだけ取得するため、
   * 未取得の間は名前を出さず「Task Templateから作成」と示す（一覧取得は機能資格の403になり得るので、ここでは取得しない）。
   */
  const selectedRuleSourceLabel = computed(() =>
    selectedRule.value === null
      ? ""
      : formatRecurrenceSource(selectedRule.value.sourceTaskTemplateId, templates.value)
  );

  /** 選択規則をarchiveし、成功・競合いずれの場合も確認Dialogを閉じて最新状態を表示する。 */
  const confirmArchive = async (): Promise<void> => {
    await archiveRule();
    isArchiveConfirmOpen.value = false;
  };

  return {
    ...recurrences,
    canArchiveSelected,
    canEditSelected,
    changeCreationMode,
    confirmArchive,
    isArchiveConfirmOpen,
    isFormOpen,
    isOpen,
    memberOptions,
    open,
    selectedRuleAssigneeDisplayName,
    selectedRuleSourceLabel,
    startCreating,
    statusOptions,
    toggleWeekday,
  };
};
