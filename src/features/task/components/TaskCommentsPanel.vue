<script setup lang="ts">
import { computed, toRef } from "vue";

import { useTaskComments } from "@/features/task/composables/useTaskComments";

const props = withDefaults(
  defineProps<{
    projectId: number;
    taskId: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const projectId = toRef(props, "projectId");
const taskId = toRef(props, "taskId");
const disabled = toRef(props, "disabled");
const {
  cancelDelete,
  cancelEditing,
  canModifyComment,
  comments,
  commentBody,
  confirmDelete,
  deletingComment,
  editBody,
  editingCommentId,
  errorMessage,
  isDeleting,
  isLoading,
  isMutating,
  isSubmitting,
  isUpdating,
  openDeleteConfirm,
  startEditing,
  submitComment,
  submitEdit,
  successMessage,
} = useTaskComments(projectId, taskId, disabled);

const canSubmit = computed(
  () =>
    !props.disabled &&
    commentBody.value.trim().length > 0 &&
    commentBody.value.trim().length <= 2000 &&
    !isMutating.value
);

const canSaveEdit = computed(
  () =>
    editBody.value.trim().length > 0 &&
    editBody.value.trim().length <= 2000 &&
    !isMutating.value
);

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const updateDeleteDialog = (open: boolean): void => {
  if (!open) {
    cancelDelete();
  }
};
</script>

<template>
  <v-divider class="my-4" />
  <div class="text-subtitle-1 font-weight-bold mb-2">コメント</div>
  <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3">
    {{ errorMessage }}
  </v-alert>
  <v-alert
    v-if="successMessage"
    type="success"
    density="compact"
    closable
    class="mb-3"
  >
    {{ successMessage }}
  </v-alert>
  <v-list v-if="comments.length" lines="three" density="compact" class="comment-list mb-3">
    <v-list-item v-for="comment in comments" :key="comment.commentId">
      <template #prepend>
        <v-avatar color="primary" size="32">
          <span class="text-caption">{{ comment.authorDisplayName.slice(0, 1) }}</span>
        </v-avatar>
      </template>
      <v-list-item-title class="d-flex justify-space-between ga-2">
        <span>{{ comment.authorDisplayName }}</span>
        <span class="text-caption text-medium-emphasis">
          {{ formatDateTime(comment.updatedAt) }}
          <span v-if="comment.updatedAt !== comment.createdAt">（編集済み）</span>
        </span>
      </v-list-item-title>
      <div v-if="editingCommentId === comment.commentId" class="mt-2">
        <v-textarea
          v-model="editBody"
          label="コメントを編集"
          maxlength="2000"
          counter
          rows="3"
          autofocus
          :disabled="isUpdating"
        />
        <div class="d-flex justify-end ga-2">
          <v-btn
            size="small"
            variant="text"
            :disabled="isUpdating"
            @click="cancelEditing"
          >
            キャンセル
          </v-btn>
          <v-btn
            color="primary"
            size="small"
            :loading="isUpdating"
            :disabled="!canSaveEdit"
            @click="submitEdit"
          >
            更新
          </v-btn>
        </div>
      </div>
      <v-list-item-subtitle v-else class="comment-body">
        {{ comment.body }}
      </v-list-item-subtitle>
      <template
        v-if="canModifyComment(comment) && editingCommentId !== comment.commentId"
        #append
      >
        <div class="d-flex ga-1 ml-2">
          <v-btn
            icon="mdi-pencil-outline"
            size="x-small"
            variant="text"
            :disabled="isMutating"
            :aria-label="`${comment.authorDisplayName}のコメントを編集`"
            @click="startEditing(comment)"
          />
          <v-btn
            icon="mdi-delete-outline"
            color="error"
            size="x-small"
            variant="text"
            :disabled="isMutating"
            :aria-label="`${comment.authorDisplayName}のコメントを削除`"
            @click="openDeleteConfirm(comment)"
          />
        </div>
      </template>
    </v-list-item>
  </v-list>
  <div v-else-if="!isLoading" class="text-body-2 text-medium-emphasis mb-3">
    まだコメントはありません。
  </div>
  <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />
  <v-textarea
    v-model="commentBody"
    label="コメントを追加"
    placeholder="@loginIdでメンションできます"
    maxlength="2000"
    counter
    rows="3"
    :readonly="disabled"
    :disabled="disabled || isMutating"
    class="mb-2"
  />
  <div class="d-flex justify-end">
    <v-btn color="primary" :loading="isSubmitting" :disabled="!canSubmit" @click="submitComment">
      コメントを投稿
    </v-btn>
  </div>

  <v-dialog
    :model-value="deletingComment !== null"
    max-width="480"
    :persistent="isDeleting"
    @update:model-value="updateDeleteDialog"
  >
    <v-card>
      <v-card-title>コメントを削除しますか？</v-card-title>
      <v-card-text>
        削除したコメントは元に戻せません。投稿時に送信済みのメンション通知は履歴として残ります。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isDeleting" @click="cancelDelete">キャンセル</v-btn>
        <v-btn
          color="error"
          :loading="isDeleting"
          :disabled="isUpdating || isSubmitting"
          @click="confirmDelete"
        >
          削除
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.comment-list {
  max-height: 240px;
  overflow-y: auto;
  background: rgb(var(--v-theme-surface-variant));
}

.comment-body {
  white-space: pre-wrap;
}
</style>
