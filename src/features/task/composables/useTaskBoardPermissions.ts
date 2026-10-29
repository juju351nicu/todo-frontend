import { computed, type Ref } from "vue";

import { useUserStore } from "@/features/auth/stores/user";
import type { ProjectDetail } from "@/features/project/types/project";
import { canManageProject, canManageProjectTasks, findProjectRole } from "@/features/project/utils/projectRole";
import { isActiveProject } from "@/features/project/utils/projectStatus";

/**
 * Board画面の、Project単位の操作の可否（permission・Project role・Projectの状態から決まるもの）を求める。
 *
 * 開いているTaskごとに変わる可否（担当者本人か、通常Taskか等）は`useTaskEditor`が持つ。
 * どれも表示の出し分けのためで、最終的な認可はBackendが行う。
 *
 * @param project Project詳細（参加者・状態）。未取得時はnull
 */
export const useTaskBoardPermissions = (project: Ref<ProjectDetail | null>) => {
  const userStore = useUserStore();

  const isProjectActive = computed(() => isActiveProject(project.value));
  const canCreateTask = computed(
    () => userStore.hasPermission("TASK_CREATE") && isProjectActive.value
  );
  const canUpdateTask = computed(
    () => userStore.hasPermission("TASK_UPDATE") && isProjectActive.value
  );
  /**
   * 本人のTask Templateをarchiveできるか。Templateは本人専用で、BackendはTASK_READで保存・archiveを許す
   * （参照のみの利用者も、自分で作ったTemplateを消せるようにするため）。
   * TemplateはProjectに属さないため、Projectの状態は問わない。
   */
  const canArchiveTaskTemplate = computed(() => userStore.hasPermission("TASK_READ"));
  const currentProjectRole = computed(() =>
    findProjectRole(project.value, userStore.accountId)
  );
  /** Project内のTaskを管理できるか（SYSTEM_ADMIN、またはOWNER・MANAGER）。 */
  const canManageTasks = computed(() =>
    canManageProjectTasks(userStore.hasRole("SYSTEM_ADMIN"), currentProjectRole.value)
  );
  const isCurrentUserProjectMember = computed(() =>
    (project.value?.members ?? []).some(
      (member) => member.accountId === userStore.accountId
    )
  );
  /**
   * このProjectで変更操作（コメント投稿・Template保存等）へ進めるか。READ_ONLY_ADMINは参加していないProjectも
   * 参照できるが変更できない（Backendの`ProjectAuthorizationLogic#canOperateProject`）。
   */
  const canOperateProject = computed(
    () => userStore.hasRole("SYSTEM_ADMIN") || isCurrentUserProjectMember.value
  );
  /**
   * Task Dialogのコメント欄で投稿できるか。Backendは`TASK_READ`とProjectへの参加（SYSTEM_ADMINは不要）で投稿を許可し、
   * 担当者・`TASK_UPDATE`は問わない（`todo-backend`の`docs/task-comment-design.md`「1.3 規則」）。
   * archive済みProjectではBackendが409で拒否するため、利用中のProjectに限る。
   */
  const canPostTaskComment = computed(
    () =>
      userStore.hasPermission("TASK_READ") &&
      isProjectActive.value &&
      canOperateProject.value
  );
  const canCreateTaskRecurrence = computed(
    () =>
      canCreateTask.value &&
      canManageTasks.value
  );
  const canCaptureProjectTemplate = computed(
    () =>
      userStore.hasPermission("PROJECT_CREATE") &&
      isProjectActive.value &&
      canManageProject(userStore.hasRole("SYSTEM_ADMIN"), currentProjectRole.value)
  );
  const canUpdateTaskRecurrence = computed(
    () =>
      canUpdateTask.value &&
      canManageTasks.value
  );
  const canMoveTask = computed(
    () =>
      userStore.hasPermission("TASK_MOVE") &&
      isProjectActive.value &&
      canManageTasks.value
  );
  const canArchiveTask = computed(
    () =>
      userStore.hasPermission("TASK_ARCHIVE") &&
      isProjectActive.value &&
      canManageTasks.value
  );
  /**
   * Task Templateを適用するときに担当者を限定するaccount ID。限定しない場合はnull。
   * MEMBERは自分を担当者にするTaskだけを作成できる（Backendの`TaskResourceAuthorizationLogic#checkCanCreate`）ため、
   * 既定担当が他人のTemplateをそのまま適用すると403になる。MEMBERには自分だけを候補にし、初期値も自分にする。
   */
  const taskTemplateAssigneeAccountId = computed<number | null>(() =>
    canManageTasks.value ? null : userStore.accountId
  );

  return {
    canArchiveTask,
    canArchiveTaskTemplate,
    canCaptureProjectTemplate,
    canCreateTask,
    canCreateTaskRecurrence,
    canManageTasks,
    canMoveTask,
    canOperateProject,
    canPostTaskComment,
    canUpdateTask,
    canUpdateTaskRecurrence,
    isCurrentUserProjectMember,
    taskTemplateAssigneeAccountId,
  };
};

/** `useTaskBoardPermissions`の戻り値（領域別composableへ渡す）。 */
export type TaskBoardPermissions = ReturnType<typeof useTaskBoardPermissions>;
