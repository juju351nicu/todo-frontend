<script setup lang="ts">
import { toRef } from "vue";

import { useProjectComments } from "@/features/task/composables/useProjectComments";
import type { ProjectTaskComment } from "@/features/task/types/taskComment";

const props = defineProps<{
  /** コメントを横断取得するProject ID。 */
  projectId: number;
}>();

const emit = defineEmits<{
  /** archiveされていないコメント対象Taskの詳細を開く。 */
  taskSelected: [taskId: number];
}>();

const projectId = toRef(props, "projectId");
const {
  closeComments,
  comments,
  errorMessage,
  isLoading,
  isOpen,
  loadComments,
  openComments,
} = useProjectComments(projectId);

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

/** archiveされていないTaskだけを既存Task詳細Dialogへ引き渡す。 */
const selectTask = (comment: ProjectTaskComment): void => {
  if (comment.taskArchived) {
    return;
  }
  closeComments();
  emit("taskSelected", comment.taskId);
};
</script>

<template>
  <v-btn
    prepend-icon="mdi-comment-multiple-outline"
    variant="tonal"
    @click="openComments"
  >
    コメント一覧
  </v-btn>

  <v-dialog :model-value="isOpen" max-width="760" @update:model-value="closeComments">
    <v-card>
      <v-card-title class="d-flex align-center">
        Projectのコメント
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="text"
          :loading="isLoading"
          :disabled="isLoading"
          aria-label="Projectコメントを再読み込み"
          @click="loadComments"
        />
      </v-card-title>
      <v-card-subtitle>最終更新日時が新しい順に最大100件表示します。</v-card-subtitle>
      <v-card-text>
        <v-alert v-if="errorMessage" type="error" density="compact" class="mb-3">
          {{ errorMessage }}
        </v-alert>
        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />
        <v-list v-if="comments.length" lines="three" class="project-comment-list">
          <v-list-item
            v-for="comment in comments"
            :key="comment.commentId"
            :disabled="comment.taskArchived"
            @click="selectTask(comment)"
          >
            <template #prepend>
              <v-avatar color="primary" size="36">
                <span class="text-caption">{{ comment.authorDisplayName.slice(0, 1) }}</span>
              </v-avatar>
            </template>
            <v-list-item-title class="d-flex align-center flex-wrap ga-2">
              <span>{{ comment.taskTitle }}</span>
              <v-chip v-if="comment.taskArchived" size="x-small">アーカイブ済み</v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>
              {{ comment.authorDisplayName }}・{{ formatDateTime(comment.updatedAt) }}
              <span v-if="comment.updatedAt !== comment.createdAt">（編集済み）</span>
            </v-list-item-subtitle>
            <div class="project-comment-body text-body-2 mt-2">{{ comment.body }}</div>
            <template v-if="!comment.taskArchived" #append>
              <v-icon icon="mdi-chevron-right" aria-hidden="true" />
            </template>
          </v-list-item>
        </v-list>
        <div v-else-if="!isLoading" class="text-body-2 text-medium-emphasis py-6 text-center">
          Project内にコメントはありません。
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="closeComments">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.project-comment-list {
  max-height: 60vh;
  overflow-y: auto;
}

.project-comment-body {
  white-space: pre-wrap;
}
</style>
