<script setup lang="ts">
import { toRef } from "vue";

import { useProjectComments } from "@/features/task/composables/useProjectComments";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { getAccountStatusColor, getAccountStatusLabel } from "@/shared/utils/accountStatus";
import { formatShortDateTime } from "@/shared/utils/dateTime";

const props = defineProps<{
  /** コメントを横断取得するProject ID。 */
  projectId: number;
}>();

const emit = defineEmits<{
  /** archiveされていないコメント対象Taskの詳細を開く。 */
  taskSelected: [taskId: number];
}>();

const { closeComments, comments, errorMessages, isLoading, isOpen, loadComments, openComments, selectTask } =
  useProjectComments(toRef(props, "projectId"), (taskId) => emit("taskSelected", taskId));
</script>

<template>
  <UButton icon="i-mdi-comment-multiple-outline" variant="soft" @click="openComments">コメント一覧</UButton>

  <UModal
    :open="isOpen"
    description="最終更新日時が新しい順に最大100件表示します。"
    :ui="{ content: 'max-w-190' }"
    @update:open="closeComments"
  >
    <template #title>
      <!-- w-fullにしないと見出しの幅が文字分だけになり、ms-autoの再読み込みボタンが右端へ寄らない。 -->
      <span class="flex w-full items-center">
        Projectのコメント
        <UButton
          icon="i-mdi-refresh"
          size="sm"
          variant="ghost"
          square
          class="ms-auto"
          :loading="isLoading"
          :disabled="isLoading"
          aria-label="Projectコメントを再読み込み"
          @click="loadComments"
        />
      </span>
    </template>
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" density="compact" class="mb-3">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <UProgress v-if="isLoading" size="xs" class="mb-3" />
      <ul v-if="comments.length" class="max-h-[60vh] overflow-y-auto py-2">
        <li v-for="comment in comments" :key="comment.commentId">
          <button
            type="button"
            class="flex w-full items-start gap-4 px-4 py-2 text-start enabled:hover:bg-elevated disabled:cursor-default"
            :disabled="comment.taskArchived"
            @click="selectTask(comment)"
          >
            <UAvatar :text="comment.authorDisplayName.slice(0, 1)" size="lg" class="bg-primary text-xs text-white" />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2 text-base">
                <span>{{ comment.taskTitle }}</span>
                <!-- archive済みTaskの行は開けないが、会話の履歴として読めるよう薄くせず、ラベル（neutral）だけで示す。 -->
                <UBadge v-if="comment.taskArchived" size="xs" color="neutral" variant="outline">アーカイブ済み</UBadge>
              </span>
              <span class="block text-sm text-muted">
                {{ comment.authorDisplayName }}
                <UBadge
                  v-if="comment.authorAccountStatus !== 'ACTIVE'"
                  size="xs"
                  variant="outline"
                  :color="getAccountStatusColor(comment.authorAccountStatus)"
                  class="me-1"
                >
                  {{ getAccountStatusLabel(comment.authorAccountStatus) }}
                </UBadge>・{{ formatShortDateTime(comment.updatedAt) }}
                <span v-if="comment.updatedAt !== comment.createdAt">（編集済み）</span>
              </span>
              <span class="mt-2 block text-sm whitespace-pre-wrap">{{ comment.body }}</span>
            </span>
            <UIcon v-if="!comment.taskArchived" name="i-mdi-chevron-right" class="size-6 text-muted" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div v-else-if="!isLoading" class="py-6 text-center text-sm text-muted">Project内にコメントはありません。</div>
    </template>
    <template #footer>
      <UButton variant="ghost" @click="closeComments">閉じる</UButton>
    </template>
  </UModal>
</template>
