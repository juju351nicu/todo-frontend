<script setup lang="ts">
import { computed, toRef } from "vue";

import { useTaskChecklist } from "@/features/task/composables/useTaskChecklist";

const props = withDefaults(
  defineProps<{
    projectId: number;
    taskId: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);

const {
  addItem,
  canAdd,
  cancelDelete,
  cancelEditing,
  completedCount,
  confirmDelete,
  deletingItem,
  editContent,
  editingItemId,
  errorMessage,
  isCreating,
  isDeleting,
  isLoading,
  isMutating,
  isUpdating,
  items,
  moveItem,
  newContent,
  openDeleteConfirm,
  saveEdit,
  startEditing,
  successMessage,
  toggleItem,
} = useTaskChecklist(
  toRef(props, "projectId"),
  toRef(props, "taskId"),
  toRef(props, "disabled")
);

const progress = computed(() =>
  items.value.length === 0
    ? 0
    : Math.round((completedCount.value / items.value.length) * 100)
);
const canSaveEdit = computed(
  () =>
    editContent.value.trim().length > 0 &&
    editContent.value.trim().length <= 255 &&
    !isMutating.value
);

/** Dialogを外部操作で閉じた場合も削除確認対象を破棄する。 */
const updateDeleteDialog = (open: boolean): void => {
  if (!open) cancelDelete();
};
</script>

<template>
  <v-divider class="my-4" />
  <div class="d-flex align-center justify-space-between mb-2">
    <div class="text-subtitle-1 font-weight-bold">チェックリスト</div>
    <div v-if="items.length" class="text-caption text-medium-emphasis">
      {{ completedCount }} / {{ items.length }}（{{ progress }}%）
    </div>
  </div>
  <v-progress-linear
    v-if="items.length"
    :model-value="progress"
    color="success"
    height="6"
    rounded
    class="mb-3"
  />
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
  <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />
  <v-list v-if="items.length" density="compact" class="checklist mb-3">
    <v-list-item v-for="(item, index) in items" :key="item.checklistItemId">
      <template #prepend>
        <v-checkbox-btn
          :model-value="item.completed"
          :disabled="disabled || isMutating"
          :aria-label="`${item.content}の完了状態を変更`"
          @click.prevent="toggleItem(item)"
        />
      </template>
      <div v-if="editingItemId === item.checklistItemId" class="d-flex align-center ga-2 py-1">
        <v-text-field
          v-model="editContent"
          label="チェック項目"
          maxlength="255"
          counter
          density="compact"
          hide-details="auto"
          autofocus
          :disabled="isUpdating"
          @keydown.enter.prevent="saveEdit"
        />
        <v-btn size="small" variant="text" :disabled="isUpdating" @click="cancelEditing">
          取消
        </v-btn>
        <v-btn color="primary" size="small" :loading="isUpdating" :disabled="!canSaveEdit" @click="saveEdit">
          保存
        </v-btn>
      </div>
      <v-list-item-title
        v-else
        :class="{ 'text-decoration-line-through text-medium-emphasis': item.completed }"
      >
        {{ item.content }}
      </v-list-item-title>
      <template v-if="editingItemId !== item.checklistItemId" #append>
        <div class="d-flex ga-1">
          <v-btn
            icon="mdi-arrow-up"
            size="x-small"
            variant="text"
            :disabled="disabled || isMutating || index === 0"
            :aria-label="`${item.content}を上へ移動`"
            @click="moveItem(item, -1)"
          />
          <v-btn
            icon="mdi-arrow-down"
            size="x-small"
            variant="text"
            :disabled="disabled || isMutating || index === items.length - 1"
            :aria-label="`${item.content}を下へ移動`"
            @click="moveItem(item, 1)"
          />
          <v-btn
            icon="mdi-pencil-outline"
            size="x-small"
            variant="text"
            :disabled="disabled || isMutating"
            :aria-label="`${item.content}を編集`"
            @click="startEditing(item)"
          />
          <v-btn
            icon="mdi-delete-outline"
            color="error"
            size="x-small"
            variant="text"
            :disabled="disabled || isMutating"
            :aria-label="`${item.content}を削除`"
            @click="openDeleteConfirm(item)"
          />
        </div>
      </template>
    </v-list-item>
  </v-list>
  <div v-else-if="!isLoading" class="text-body-2 text-medium-emphasis mb-3">
    まだチェック項目はありません。
  </div>
  <div class="d-flex align-start ga-2">
    <v-text-field
      v-model="newContent"
      label="チェック項目を追加"
      maxlength="255"
      counter
      density="compact"
      hide-details="auto"
      :disabled="disabled || isMutating || items.length >= 50"
      @keydown.enter.prevent="addItem"
    />
    <v-btn color="primary" :loading="isCreating" :disabled="!canAdd" @click="addItem">
      追加
    </v-btn>
  </div>
  <div v-if="items.length >= 50" class="text-caption text-warning mt-1">
    チェック項目は最大50件です。
  </div>

  <v-dialog
    :model-value="deletingItem !== null"
    max-width="480"
    :persistent="isDeleting"
    @update:model-value="updateDeleteDialog"
  >
    <v-card>
      <v-card-title>チェック項目を削除しますか？</v-card-title>
      <v-card-text>{{ deletingItem?.content }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isDeleting" @click="cancelDelete">キャンセル</v-btn>
        <v-btn color="error" :loading="isDeleting" @click="confirmDelete">削除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.checklist {
  max-height: 280px;
  overflow-y: auto;
  background: rgb(var(--v-theme-surface-variant));
}
</style>
