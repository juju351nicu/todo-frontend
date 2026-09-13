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
const {
  comments,
  commentBody,
  errorMessage,
  isLoading,
  isSubmitting,
  submitComment,
} = useTaskComments(projectId, taskId);

const canSubmit = computed(
  () => !props.disabled && commentBody.value.trim().length > 0 && !isSubmitting.value
);

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
</script>

<template>
  <v-divider class="my-4" />
  <div class="text-subtitle-1 font-weight-bold mb-2">コメント</div>
  <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3">
    {{ errorMessage }}
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
        <span class="text-caption text-medium-emphasis">{{ formatDateTime(comment.createdAt) }}</span>
      </v-list-item-title>
      <v-list-item-subtitle class="comment-body">{{ comment.body }}</v-list-item-subtitle>
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
    :disabled="disabled || isSubmitting"
    class="mb-2"
  />
  <div class="d-flex justify-end">
    <v-btn color="primary" :loading="isSubmitting" :disabled="!canSubmit" @click="submitComment">
      コメントを投稿
    </v-btn>
  </div>
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
