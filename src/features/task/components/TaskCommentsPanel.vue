<script setup lang="ts">
import { toRef } from "vue";

import {
  COMMENT_COMPOSER_CONTROL,
  buildCommentEditControlKey,
  useTaskComments,
} from "@/features/task/composables/useTaskComments";
import { TASK_COMMENT_MAX_LENGTH } from "@/features/task/constants/taskLimits";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";
import { getAccountStatusColor, getAccountStatusLabel } from "@/shared/utils/accountStatus";
import { formatShortDateTime } from "@/shared/utils/dateTime";

/**
 * Task Dialog内のコメント欄。取得・投稿・本人の編集削除・競合回復・フォーカス戻しは`useTaskComments`が担当し、
 * このComponentは一覧・投稿欄・編集欄・削除確認Dialogの表示だけを行う。
 */
const props = withDefaults(
  defineProps<{
    /** 対象TaskのProject ID。 */
    projectId: number;
    /** 対象Task ID。変わると一覧を取り直し、投稿欄・編集中・削除確認中の状態を捨てる。 */
    taskId: number;
    /**
     * 投稿・編集・削除をさせないときtrue（`TASK_READ`がない、archive済みProject。`useTaskBoardPage#canPostTaskComment`）。
     * trueの間は投稿欄を読み取り専用にし、本人のコメントにも編集・削除ボタンを出さない。
     */
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const {
  cancelDelete,
  canModifyComment,
  canSaveEdit,
  canSubmit,
  comments,
  commentBody,
  confirmDelete,
  deletingComment,
  discardEditing,
  editBody,
  editingCommentId,
  errorMessages,
  handleDeleteDialogVisibility,
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
} = useTaskComments(toRef(props, "projectId"), toRef(props, "taskId"), toRef(props, "disabled"));
</script>

<template>
  <USeparator class="my-4" />
  <div class="mb-2 text-base font-bold">コメント</div>
  <StatusAlert v-if="errorMessages.length" type="error" density="compact" class="mb-3">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </StatusAlert>
  <StatusAlert v-if="successMessage" type="success" density="compact" closable class="mb-3" @close="successMessage = ''">
    {{ successMessage }}
  </StatusAlert>
  <ul v-if="comments.length" class="mb-3 max-h-60 overflow-y-auto rounded-sm bg-muted py-2 text-default">
    <li v-for="comment in comments" :key="comment.commentId" class="flex items-start gap-4 px-4 py-2">
      <UAvatar :text="comment.authorDisplayName.slice(0, 1)" size="md" class="bg-primary text-xs text-white" />
      <div class="min-w-0 flex-1">
        <div class="flex justify-between gap-2 text-base">
          <span>
            {{ comment.authorDisplayName }}
            <UBadge
              v-if="comment.authorAccountStatus !== 'ACTIVE'"
              size="xs"
              variant="outline"
              :color="getAccountStatusColor(comment.authorAccountStatus)"
              class="ms-1"
            >
              {{ getAccountStatusLabel(comment.authorAccountStatus) }}
            </UBadge>
          </span>
          <span class="text-xs opacity-70">
            {{ formatShortDateTime(comment.updatedAt) }}
            <span v-if="comment.updatedAt !== comment.createdAt">（編集済み）</span>
          </span>
        </div>
        <div v-if="editingCommentId === comment.commentId" class="mt-2">
          <div class="relative">
            <UFormField label="コメントを編集">
              <!-- Escは編集の取消だけにする。preventDefaultしないとTask Dialog（UModal）もEscで閉じ、編集中の本文ごと失われるため。 -->
              <UTextarea
                v-model="editBody"
                :maxlength="TASK_COMMENT_MAX_LENGTH"
                :rows="3"
                autofocus
                :disabled="isUpdating"
                class="w-full"
                @keydown.esc.prevent="discardEditing"
              />
            </UFormField>
            <FieldCounter :value="editBody" :max="TASK_COMMENT_MAX_LENGTH" />
          </div>
          <div class="flex justify-end gap-2">
            <UButton size="sm" variant="ghost" class="text-inherit" :disabled="isUpdating" @click="discardEditing">
              キャンセル
            </UButton>
            <UButton color="primary" size="sm" :loading="isUpdating" :disabled="!canSaveEdit" @click="submitEdit">更新</UButton>
          </div>
        </div>
        <div v-else class="text-sm whitespace-pre-wrap opacity-70">{{ comment.body }}</div>
      </div>
      <div v-if="canModifyComment(comment) && editingCommentId !== comment.commentId" class="ms-2 flex gap-1">
        <UButton
          icon="i-mdi-pencil-outline"
          size="xs"
          variant="ghost"
          square
          class="text-inherit"
          :disabled="isMutating"
          :aria-label="`${comment.authorDisplayName}のコメント（${formatShortDateTime(comment.createdAt)}投稿）を編集`"
          :data-comment-control="buildCommentEditControlKey(comment.commentId)"
          @click="startEditing(comment)"
        />
        <UButton
          icon="i-mdi-delete-outline"
          color="error"
          size="xs"
          variant="ghost"
          square
          :disabled="isMutating"
          :aria-label="`${comment.authorDisplayName}のコメント（${formatShortDateTime(comment.createdAt)}投稿）を削除`"
          @click="openDeleteConfirm(comment)"
        />
      </div>
    </li>
  </ul>
  <div v-else-if="!isLoading" class="mb-3 text-sm text-muted">まだコメントはありません。</div>
  <UProgress v-if="isLoading" size="xs" class="mb-3" />
  <div class="relative mb-2">
    <UFormField label="コメントを追加">
      <UTextarea
        v-model="commentBody"
        placeholder="@loginIdでメンションできます"
        :maxlength="TASK_COMMENT_MAX_LENGTH"
        :rows="3"
        :readonly="disabled"
        :disabled="disabled || isMutating"
        class="w-full"
        :data-comment-control="COMMENT_COMPOSER_CONTROL"
      />
    </UFormField>
    <FieldCounter :value="commentBody" :max="TASK_COMMENT_MAX_LENGTH" />
  </div>
  <div class="flex justify-end">
    <UButton color="primary" :loading="isSubmitting" :disabled="!canSubmit" @click="submitComment">コメントを投稿</UButton>
  </div>

  <UModal
    :open="deletingComment !== null"
    :dismissible="!isDeleting"
    title="コメントを削除しますか？"
    :ui="{ content: 'max-w-120' }"
    @update:open="handleDeleteDialogVisibility"
  >
    <template #body>削除したコメントは元に戻せません。投稿時に送信済みのメンション通知は履歴として残ります。</template>
    <template #footer>
      <UButton variant="ghost" :disabled="isDeleting" @click="cancelDelete">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isDeleting" :disabled="isUpdating || isSubmitting" @click="confirmDelete">
        削除
      </UButton>
    </template>
  </UModal>
</template>
