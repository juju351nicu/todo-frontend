<script setup lang="ts">
import { onBeforeMount } from "vue";
import Draggable from "vuedraggable";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import ProjectSettingsDialog from "@/features/project/components/ProjectSettingsDialog.vue";
import ProjectTemplateCaptureButton from "@/features/project/components/ProjectTemplateCaptureButton.vue";
import {
  getProjectStatusColor,
  getProjectStatusLabel,
  isActiveProject,
} from "@/features/project/utils/projectStatus";
import ProjectCommentsDialog from "@/features/task/components/ProjectCommentsDialog.vue";
import TaskCommentsPanel from "@/features/task/components/TaskCommentsPanel.vue";
import TaskChecklistPanel from "@/features/task/components/TaskChecklistPanel.vue";
import TaskRecurrenceDialog from "@/features/task/components/TaskRecurrenceDialog.vue";
import TaskTemplateCaptureButton from "@/features/task/components/TaskTemplateCaptureButton.vue";
import TaskTemplateDialog from "@/features/task/components/TaskTemplateDialog.vue";
import { useTaskBoardPage } from "@/features/task/composables/useTaskBoardPage";
import {
  TASK_DETAIL_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from "@/features/task/constants/taskLimits";
import { getTaskPriorityColor, getTaskPriorityLabel } from "@/features/task/utils/taskDisplay";
import TaskTimerActionButton from "@/features/time-tracking/components/TaskTimerActionButton.vue";
import TaskWorkLogAuditDialog from "@/features/time-tracking/components/TaskWorkLogAuditDialog.vue";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  applyProjectDetail,
  archiveTask,
  board,
  canArchiveTask,
  canCaptureProjectTemplate,
  canCreateTask,
  canCreateTaskRecurrence,
  canMoveTask,
  canSave,
  canStartTaskTimer,
  canCaptureTaskTemplate,
  canPostTaskComment,
  canRecordTaskWork,
  canArchiveTaskTemplate,
  canUpdateTask,
  canUpdateTaskRecurrence,
  closeArchiveConfirm,
  closeTaskEditor,
  taskTemplateAssigneeAccountId,
  editorErrorMessages,
  errorMessages,
  finishTaskDrag,
  form,
  handleEditorOpenChange,
  handleTaskDrop,
  handleTemplateTaskCreated,
  initialize,
  isArchiveConfirmOpen,
  isArchiving,
  isEditorOpen,
  isLoading,
  isLoadingTask,
  isMoving,
  isReadonly,
  isSaving,
  memberOptions,
  moveTaskByKeyboard,
  openArchiveConfirm,
  openTaskCreator,
  openTaskEditor,
  openTaskWorkLogs,
  priorityOptions,
  project,
  resolveAssigneeDisplayName,
  saveTask,
  statusOptions,
  startTaskDrag,
  successMessage,
} = useTaskBoardPage();

// Task cardの左線は優先度色と同じ色にする（getTaskPriorityColorと対応）。
const PRIORITY_BORDER_CLASSES = { 1: "border-s-info", 2: "border-s-warning", 3: "border-s-error" } as const;

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading || isLoadingTask || isMoving || isArchiving" />
  <div class="page-surface p-6">
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <UButton
        :to="{ name: ROUTE_NAMES.projectList }"
        icon="i-mdi-arrow-left"
        variant="ghost"
        square
        size="lg"
        class="size-12 text-inherit hover:bg-white/4"
        :ui="{ leadingIcon: 'size-6' }"
        aria-label="Project一覧へ戻る"
      />
      <div>
        <h1 class="text-2xl">{{ board?.projectName ?? "Project Board" }}</h1>
        <div v-if="project" class="text-sm opacity-70">
          {{ project.projectKey }}
          <span v-if="project.description">・{{ project.description }}</span>
        </div>
      </div>
      <UBadge v-if="project" :color="getProjectStatusColor(project.status)" size="sm" class="ms-auto">
        {{ getProjectStatusLabel(project.status) }}
      </UBadge>
      <UButton
        v-if="board"
        :to="{ name: ROUTE_NAMES.wbs, params: { projectId: board.projectId } }"
        icon="i-mdi-file-tree-outline"
        variant="soft"
      >
        WBSを開く
      </UButton>
      <ProjectCommentsDialog v-if="board" :project-id="board.projectId" @task-selected="openTaskEditor" />
      <ProjectTemplateCaptureButton
        v-if="project && canCaptureProjectTemplate"
        :project-id="project.projectId"
        :disabled="project.status !== 'ACTIVE'"
      />
      <TaskTemplateDialog
        v-if="project"
        :project-id="project.projectId"
        :members="project.members"
        :statuses="project.taskStatuses"
        :can-apply="canCreateTask"
        :can-edit="canUpdateTask"
        :can-archive="canArchiveTaskTemplate"
        :project-active="isActiveProject(project)"
        :restricted-assignee-account-id="taskTemplateAssigneeAccountId"
        @task-created="handleTemplateTaskCreated"
      />
      <TaskRecurrenceDialog
        v-if="project"
        :project-id="project.projectId"
        :members="project.members"
        :statuses="project.taskStatuses"
        :can-create="canCreateTaskRecurrence"
        :can-update="canUpdateTaskRecurrence"
        :project-active="isActiveProject(project)"
      />
      <ProjectSettingsDialog v-if="project" :project="project" @project-updated="applyProjectDetail" />
      <UButton v-if="canCreateTask" color="primary" icon="i-mdi-plus" @click="openTaskCreator()">Taskを追加</UButton>
    </div>

    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="successMessage" type="success" class="mb-4" closable @close="successMessage = ''">
      {{ successMessage }}
    </StatusAlert>
    <StatusAlert v-if="project?.status === 'ARCHIVED'" type="info" class="mb-4">
      アーカイブ済みProjectのため、Taskは参照のみ可能です。
    </StatusAlert>
    <StatusAlert v-else-if="canMoveTask" type="info" variant="soft" class="mb-4">
      Task右上の移動アイコンをドラッグするか、アイコンへフォーカスして方向キーを押すと移動できます。上下キーは列内移動、左右キーは隣の列の末尾への移動です。
    </StatusAlert>

    <div v-if="board" class="flex items-start gap-4 overflow-x-auto pb-4">
      <!-- E2Eはboard-column／task-card classで列とTask cardを特定する。列は一段濃い背景（bg-elevated）、cardは通常の背景（bg-default）にして、列とcardの境目を見せる。 -->
      <div
        v-for="column in board.columns"
        :key="column.taskStatusId"
        class="board-column flex max-h-[calc(100vh-190px)] flex-[0_0_340px] flex-col rounded-sm bg-elevated text-default"
      >
        <div class="flex items-center px-4 py-2 text-base">
          {{ column.name }}
          <UBadge size="xs" class="ms-2">{{ column.tasks.length }}</UBadge>
          <UButton
            v-if="canCreateTask"
            icon="i-mdi-plus"
            size="sm"
            variant="ghost"
            square
            class="ms-auto"
            :aria-label="`${column.name}へTaskを追加`"
            @click="openTaskCreator(column.taskStatusId)"
          />
        </div>

        <Draggable
          v-model="column.tasks"
          item-key="taskId"
          tag="div"
          class="max-h-[calc(100vh-260px)] min-h-24 overflow-y-auto p-4"
          group="project-board-tasks"
          handle=".task-drag-handle"
          ghost-class="opacity-35"
          drag-class="task-card-dragging"
          :disabled="!canMoveTask || isMoving"
          @start="startTaskDrag"
          @end="finishTaskDrag"
          @change="handleTaskDrop($event, column.taskStatusId)"
        >
          <template #item="{ element: task }">
            <div
              class="task-card mb-3 cursor-pointer rounded-sm border-s-4 bg-default ring ring-default shadow-elevation-1 focus-visible:outline-2 focus-visible:outline-primary"
              :class="PRIORITY_BORDER_CLASSES[task.priority as 1 | 2 | 3]"
              tabindex="0"
              @click="openTaskEditor(task.taskId)"
              @keydown.enter="openTaskEditor(task.taskId)"
            >
              <div class="flex items-start px-4 pt-2 text-sm font-medium break-words">
                <span>{{ task.title }}</span>
                <UButton
                  v-if="canMoveTask"
                  class="task-drag-handle ms-auto cursor-grab active:cursor-grabbing"
                  icon="i-mdi-drag"
                  size="xs"
                  variant="ghost"
                  square
                  :disabled="isMoving"
                  :data-task-move-handle="task.taskId"
                  :aria-label="`${task.title}を移動。上下キーで列内移動、左右キーで列移動`"
                  aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                  title="方向キー: 上下で列内移動、左右で列移動"
                  @click.stop
                  @keydown.up.stop.prevent="moveTaskByKeyboard(task.taskId, 'UP')"
                  @keydown.down.stop.prevent="moveTaskByKeyboard(task.taskId, 'DOWN')"
                  @keydown.left.stop.prevent="moveTaskByKeyboard(task.taskId, 'LEFT')"
                  @keydown.right.stop.prevent="moveTaskByKeyboard(task.taskId, 'RIGHT')"
                />
              </div>
              <div class="px-4 pt-4 pb-2 text-sm">
                <div class="mb-3 line-clamp-3">{{ task.detail }}</div>
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge :color="getTaskPriorityColor(task.priority)" size="xs">
                    優先度: {{ getTaskPriorityLabel(task.priority) }}
                  </UBadge>
                  <UBadge size="xs" icon="i-mdi-account-outline">{{ resolveAssigneeDisplayName(task.assigneeAccountId) }}</UBadge>
                </div>
                <div class="mt-2 text-xs text-muted">{{ task.dateFrom }} ～ {{ task.dateTo }}</div>
              </div>
            </div>
          </template>
        </Draggable>
        <div v-if="column.tasks.length === 0" class="px-4 pb-4">
          <div class="p-3 text-sm text-muted">Taskはありません。</div>
        </div>
      </div>
    </div>

    <UModal
      :open="isEditorOpen"
      :dismissible="!isSaving"
      :title="form.taskId === null ? 'Taskを追加' : isReadonly ? 'Task詳細' : 'Taskを編集'"
      :ui="{ content: 'max-w-180' }"
      @update:open="handleEditorOpenChange"
    >
      <template #body>
        <StatusAlert v-if="isReadonly" type="info" class="mb-4">このTaskは参照のみ可能です。</StatusAlert>
        <!-- 画面上部のmessageはDialogの裏に隠れるため、入力チェックと保存・archiveの失敗はDialog内に出す。 -->
        <StatusAlert v-if="editorErrorMessages.length" type="error" class="mb-4">
          <div v-for="message in editorErrorMessages" :key="message">{{ message }}</div>
        </StatusAlert>
        <form @submit.prevent="saveTask">
          <div class="relative mb-2">
            <UFormField label="タイトル">
              <UInput v-model="form.title" :maxlength="TASK_TITLE_MAX_LENGTH" :readonly="isReadonly" :disabled="isSaving" class="w-full" />
            </UFormField>
            <FieldCounter :value="form.title" :max="TASK_TITLE_MAX_LENGTH" />
          </div>
          <div class="relative mb-2">
            <UFormField label="詳細">
              <UTextarea
                v-model="form.detail"
                :maxlength="TASK_DETAIL_MAX_LENGTH"
                :rows="4"
                :readonly="isReadonly"
                :disabled="isSaving"
                class="w-full"
              />
            </UFormField>
            <FieldCounter :value="form.detail" :max="TASK_DETAIL_MAX_LENGTH" />
          </div>
          <div class="-m-3 flex flex-wrap">
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="開始日">
                <UInput v-model="form.dateFrom" type="date" :readonly="isReadonly" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="終了日">
                <UInput v-model="form.dateTo" type="date" :readonly="isReadonly" :disabled="isSaving" class="w-full" />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="担当者">
                <USelect
                  :model-value="form.assigneeAccountId ?? undefined"
                  :items="memberOptions"
                  label-key="title"
                  value-key="value"
                  :disabled="isSaving || isReadonly"
                  class="w-full"
                  @update:model-value="form.assigneeAccountId = $event"
                />
              </UFormField>
            </div>
            <div class="w-full p-3 sm:w-1/2">
              <UFormField label="優先度">
                <USelect
                  v-model="form.priority"
                  :items="[...priorityOptions]"
                  label-key="title"
                  value-key="value"
                  :disabled="isSaving || isReadonly"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
          <UFormField label="配置先の列" help="登録後の列変更はBoard上の移動操作で行います。">
            <USelect
              :model-value="form.taskStatusId ?? undefined"
              :items="statusOptions"
              label-key="title"
              value-key="value"
              :disabled="isSaving || isReadonly || form.taskId !== null"
              class="w-full"
              @update:model-value="form.taskStatusId = $event"
            />
          </UFormField>
          <div v-if="form.taskId !== null && board" class="my-4 flex flex-wrap items-center gap-2">
            <TaskTimerActionButton v-if="canStartTaskTimer" :project-id="board.projectId" :task-id="form.taskId" />
            <UButton v-if="canRecordTaskWork" icon="i-mdi-clock-edit-outline" variant="soft" size="sm" @click="openTaskWorkLogs">
              日別実績を入力
            </UButton>
            <TaskWorkLogAuditDialog :project-id="board.projectId" :task-id="form.taskId" />
          </div>
          <TaskTemplateCaptureButton
            v-if="form.taskId !== null && project !== null && canCaptureTaskTemplate"
            :project-id="project.projectId"
            :task-id="form.taskId"
            :disabled="project.status === 'ARCHIVED'"
          />
          <TaskChecklistPanel
            v-if="form.taskId !== null && project !== null"
            :project-id="project.projectId"
            :task-id="form.taskId"
            :disabled="isReadonly || project.status === 'ARCHIVED'"
          />
          <TaskCommentsPanel
            v-if="form.taskId !== null && board"
            :project-id="board.projectId"
            :task-id="form.taskId"
            :disabled="!canPostTaskComment"
          />
        </form>
      </template>
      <template #footer>
        <UButton
          v-if="form.taskId !== null && canArchiveTask"
          color="error"
          variant="ghost"
          icon="i-mdi-archive-outline"
          class="me-auto"
          :disabled="isSaving || isArchiving"
          @click="openArchiveConfirm"
        >
          アーカイブ
        </UButton>
        <UButton variant="ghost" :disabled="isSaving || isArchiving" @click="closeTaskEditor">
          {{ isReadonly ? "閉じる" : "キャンセル" }}
        </UButton>
        <UButton v-if="!isReadonly" color="primary" variant="ghost" :loading="isSaving" :disabled="!canSave" @click="saveTask">
          保存
        </UButton>
      </template>
    </UModal>

    <UModal v-model:open="isArchiveConfirmOpen" :dismissible="!isArchiving" :ui="{ content: 'max-w-130' }">
      <template #title>
        <span class="flex items-center text-error">
          <UIcon name="i-mdi-archive-alert-outline" class="me-2 size-6" />
          Taskをアーカイブしますか？
        </span>
      </template>
      <template #body>
        <p class="mb-3">「{{ form.title }}」をProject Boardから除外します。</p>
        <StatusAlert type="warning" variant="soft">この画面からアーカイブ解除はできません。内容を確認して実行してください。</StatusAlert>
      </template>
      <template #footer>
        <UButton variant="ghost" :disabled="isArchiving" @click="closeArchiveConfirm">キャンセル</UButton>
        <UButton color="error" variant="ghost" :loading="isArchiving" @click="archiveTask">アーカイブする</UButton>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* vuedraggableがドラッグ中の要素へ付けるclass。Tailwindのclassは複数指定できないため、ここで定義する。 */
.task-card-dragging {
  transform: rotate(1deg);
  box-shadow: 0 8px 20px rgb(0 0 0 / 20%);
}
</style>
