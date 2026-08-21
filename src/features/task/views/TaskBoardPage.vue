<script setup lang="ts">
import { onBeforeMount } from "vue";
import Draggable from "vuedraggable";

import AppHeader from "@/app/layouts/AppHeader.vue";
import ProjectSettingsDialog from "@/features/project/components/ProjectSettingsDialog.vue";
import { useTaskBoardPage } from "@/features/task/composables/useTaskBoardPage";
import type { TaskPriority } from "@/features/project/types/project";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  applyProjectDetail,
  archiveTask,
  board,
  canArchiveTask,
  canCreateTask,
  canMoveTask,
  canSave,
  closeArchiveConfirm,
  closeTaskEditor,
  errorMessages,
  finishTaskDrag,
  form,
  handleTaskDrop,
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
  priorityOptions,
  project,
  saveTask,
  statusOptions,
  startTaskDrag,
  successMessage,
} = useTaskBoardPage();

/** Task優先度をカード左線とChipに使用する色へ変換する。 */
const getPriorityColor = (priority: TaskPriority): string =>
  ({ 1: "error", 2: "warning", 3: "info" })[priority];

/** Task優先度を日本語表示へ変換する。 */
const getPriorityLabel = (priority: TaskPriority): string =>
  ({ 1: "高", 2: "中", 3: "低" })[priority];

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <LoadingIndicator
    v-if="isLoading || isLoadingTask || isMoving || isArchiving"
  />
  <v-container fluid class="pa-6 board-page">
    <div class="d-flex align-center flex-wrap ga-3 mb-4">
      <v-btn
        :to="{ name: 'ProjectList' }"
        icon="mdi-arrow-left"
        variant="text"
        aria-label="Project一覧へ戻る"
      />
      <div>
        <h1 class="text-h5">{{ board?.projectName ?? "Project Board" }}</h1>
        <div v-if="project" class="text-body-2 text-medium-emphasis">
          {{ project.projectKey }}
          <span v-if="project.description">・{{ project.description }}</span>
        </div>
      </div>
      <v-spacer />
      <v-chip
        v-if="project"
        :color="project.status === 'ACTIVE' ? 'success' : 'default'"
        size="small"
      >
        {{ project.status === "ACTIVE" ? "利用中" : "アーカイブ" }}
      </v-chip>
      <v-btn
        v-if="board"
        :to="{ name: 'Wbs', params: { projectId: board.projectId } }"
        prepend-icon="mdi-file-tree-outline"
        variant="tonal"
      >
        WBSを開く
      </v-btn>
      <ProjectSettingsDialog
        v-if="project"
        :project="project"
        @project-updated="applyProjectDetail"
      />
      <v-btn
        v-if="canCreateTask"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openTaskCreator()"
      >
        Taskを追加
      </v-btn>
    </div>

    <v-alert v-if="errorMessages.length" type="error" class="mb-4">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </v-alert>
    <v-alert v-if="successMessage" type="success" class="mb-4" closable>
      {{ successMessage }}
    </v-alert>
    <v-alert v-if="project?.status === 'ARCHIVED'" type="info" class="mb-4">
      アーカイブ済みProjectのため、Taskは参照のみ可能です。
    </v-alert>
    <v-alert v-else-if="canMoveTask" type="info" variant="tonal" class="mb-4">
      Task右上の移動アイコンをドラッグするか、アイコンへフォーカスして方向キーを押すと移動できます。上下キーは列内移動、左右キーは隣の列の末尾への移動です。
    </v-alert>

    <div v-if="board" class="board-columns">
      <v-card
        v-for="column in board.columns"
        :key="column.taskStatusId"
        class="board-column"
        variant="tonal"
      >
        <v-card-title class="d-flex align-center text-subtitle-1">
          {{ column.name }}
          <v-chip size="x-small" class="ml-2">{{ column.tasks.length }}</v-chip>
          <v-spacer />
          <v-btn
            v-if="canCreateTask"
            icon="mdi-plus"
            size="small"
            variant="text"
            :aria-label="`${column.name}へTaskを追加`"
            @click="openTaskCreator(column.taskStatusId)"
          />
        </v-card-title>

        <Draggable
          v-model="column.tasks"
          item-key="taskId"
          tag="div"
          class="board-task-list pa-4"
          group="project-board-tasks"
          handle=".task-drag-handle"
          ghost-class="task-card-ghost"
          drag-class="task-card-dragging"
          :disabled="!canMoveTask || isMoving"
          @start="startTaskDrag"
          @end="finishTaskDrag"
          @change="handleTaskDrop($event, column.taskStatusId)"
        >
          <template #item="{ element: task }">
            <v-card
              class="mb-3 task-card"
              :class="`priority-${task.priority}`"
              variant="elevated"
              tabindex="0"
              @click="openTaskEditor(task.taskId)"
              @keydown.enter="openTaskEditor(task.taskId)"
            >
              <v-card-title class="d-flex align-start text-subtitle-2 text-wrap">
                <span>{{ task.title }}</span>
                <v-spacer />
                <v-btn
                  v-if="canMoveTask"
                  class="task-drag-handle"
                  icon="mdi-drag"
                  size="x-small"
                  variant="text"
                  :disabled="isMoving"
                  :aria-label="`${task.title}を移動。上下キーで列内移動、左右キーで列移動`"
                  aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                  title="方向キー: 上下で列内移動、左右で列移動"
                  @click.stop
                  @keydown.up.stop.prevent="moveTaskByKeyboard(task.taskId, 'UP')"
                  @keydown.down.stop.prevent="moveTaskByKeyboard(task.taskId, 'DOWN')"
                  @keydown.left.stop.prevent="moveTaskByKeyboard(task.taskId, 'LEFT')"
                  @keydown.right.stop.prevent="moveTaskByKeyboard(task.taskId, 'RIGHT')"
                />
              </v-card-title>
              <v-card-text class="pb-2">
                <div class="task-detail text-body-2 mb-3">{{ task.detail }}</div>
                <div class="d-flex align-center flex-wrap ga-2">
                  <v-chip :color="getPriorityColor(task.priority)" size="x-small">
                    優先度: {{ getPriorityLabel(task.priority) }}
                  </v-chip>
                  <v-chip size="x-small" prepend-icon="mdi-account-outline">
                    ID: {{ task.assigneeAccountId }}
                  </v-chip>
                </div>
                <div class="text-caption text-medium-emphasis mt-2">
                  {{ task.dateFrom }} ～ {{ task.dateTo }}
                </div>
              </v-card-text>
            </v-card>
          </template>
        </Draggable>
        <v-card-text v-if="column.tasks.length === 0" class="pt-0">
          <div class="text-body-2 text-medium-emphasis pa-3">
            Taskはありません。
          </div>
        </v-card-text>
      </v-card>
    </div>

    <v-dialog v-model="isEditorOpen" max-width="720" :persistent="isSaving">
      <v-card>
        <v-card-title>
          {{ form.taskId === null ? "Taskを追加" : isReadonly ? "Task詳細" : "Taskを編集" }}
        </v-card-title>
        <v-card-text>
          <v-alert v-if="isReadonly" type="info" class="mb-4">
            このTaskは参照のみ可能です。
          </v-alert>
          <v-form @submit.prevent="saveTask">
            <v-text-field
              v-model="form.title"
              label="タイトル"
              maxlength="45"
              counter
              :readonly="isReadonly"
              :disabled="isSaving"
              class="mb-2"
            />
            <v-textarea
              v-model="form.detail"
              label="詳細"
              maxlength="1000"
              counter
              rows="4"
              :readonly="isReadonly"
              :disabled="isSaving"
              class="mb-2"
            />
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.dateFrom"
                  label="開始日"
                  type="date"
                  :readonly="isReadonly"
                  :disabled="isSaving"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.dateTo"
                  label="終了日"
                  type="date"
                  :readonly="isReadonly"
                  :disabled="isSaving"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.assigneeAccountId"
                  label="担当者"
                  :items="memberOptions"
                  :readonly="isReadonly"
                  :disabled="isSaving"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.priority"
                  label="優先度"
                  :items="priorityOptions"
                  :readonly="isReadonly"
                  :disabled="isSaving"
                />
              </v-col>
            </v-row>
            <v-select
              v-model="form.taskStatusId"
              label="配置先の列"
              :items="statusOptions"
              :readonly="isReadonly"
              :disabled="isSaving || form.taskId !== null"
              hint="登録後の列変更はBoard上の移動操作で行います。"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="form.taskId !== null && canArchiveTask"
            color="error"
            variant="text"
            prepend-icon="mdi-archive-outline"
            :disabled="isSaving || isArchiving"
            @click="openArchiveConfirm"
          >
            アーカイブ
          </v-btn>
          <v-spacer />
          <v-btn :disabled="isSaving || isArchiving" @click="closeTaskEditor">
            {{ isReadonly ? "閉じる" : "キャンセル" }}
          </v-btn>
          <v-btn
            v-if="!isReadonly"
            color="primary"
            :loading="isSaving"
            :disabled="!canSave"
            @click="saveTask"
          >
            保存
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="isArchiveConfirmOpen"
      max-width="520"
      :persistent="isArchiving"
    >
      <v-card>
        <v-card-title class="d-flex align-center text-error">
          <v-icon icon="mdi-archive-alert-outline" class="mr-2" />
          Taskをアーカイブしますか？
        </v-card-title>
        <v-card-text>
          <p class="mb-3">
            「{{ form.title }}」をProject Boardから除外します。
          </p>
          <v-alert type="warning" variant="tonal">
            この画面からアーカイブ解除はできません。内容を確認して実行してください。
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="isArchiving" @click="closeArchiveConfirm">
            キャンセル
          </v-btn>
          <v-btn color="error" :loading="isArchiving" @click="archiveTask">
            アーカイブする
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.board-page {
  min-height: calc(100vh - 64px);
  background: rgb(var(--v-theme-surface-variant));
}

.board-columns {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 16px;
}

.board-column {
  flex: 0 0 340px;
  max-height: calc(100vh - 190px);
}

.board-task-list {
  min-height: 96px;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
}

.task-card {
  cursor: pointer;
  border-left: 4px solid transparent;
}

.task-drag-handle {
  cursor: grab;
}

.task-drag-handle:active {
  cursor: grabbing;
}

.task-card-ghost {
  opacity: 0.35;
}

.task-card-dragging {
  transform: rotate(1deg);
  box-shadow: 0 8px 20px rgb(0 0 0 / 20%);
}

.task-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
}

.task-card.priority-1 {
  border-left-color: rgb(var(--v-theme-error));
}

.task-card.priority-2 {
  border-left-color: rgb(var(--v-theme-warning));
}

.task-card.priority-3 {
  border-left-color: rgb(var(--v-theme-info));
}

.task-detail {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
</style>
