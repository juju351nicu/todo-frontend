<script setup lang="ts">
import { toRef } from "vue";

import {
  CHECKLIST_ITEM_MAX_COUNT,
  CHECKLIST_ITEM_MAX_LENGTH,
  useTaskChecklist,
} from "@/features/task/composables/useTaskChecklist";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = withDefaults(
  defineProps<{
    projectId: number;
    taskId: number;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const {
  addItem,
  canAdd,
  canSaveEdit,
  cancelDelete,
  cancelEditing,
  completedCount,
  confirmDelete,
  deletingItem,
  editContent,
  editingItemId,
  errorMessages,
  handleDeleteDialogVisibility,
  isCreating,
  isDeleting,
  isLoading,
  isMutating,
  isUpdating,
  items,
  moveItem,
  newContent,
  openDeleteConfirm,
  progressPercent,
  saveEdit,
  startEditing,
  successMessage,
  toggleItem,
} = useTaskChecklist(toRef(props, "projectId"), toRef(props, "taskId"), toRef(props, "disabled"));
</script>

<template>
  <USeparator class="my-4" />
  <div class="mb-2 flex items-center justify-between">
    <div class="text-base font-bold">チェックリスト</div>
    <div v-if="items.length" class="text-xs text-muted">{{ completedCount }} / {{ items.length }}（{{ progressPercent }}%）</div>
  </div>
  <UProgress
    v-if="items.length"
    :model-value="progressPercent"
    color="success"
    class="mb-3"
    :ui="{ base: 'h-1.5 rounded-full', indicator: 'rounded-full' }"
  />
  <StatusAlert v-if="errorMessages.length" type="error" density="compact" class="mb-3">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </StatusAlert>
  <StatusAlert v-if="successMessage" type="success" density="compact" closable class="mb-3" @close="successMessage = ''">
    {{ successMessage }}
  </StatusAlert>
  <UProgress v-if="isLoading" size="xs" class="mb-3" />
  <ul v-if="items.length" class="mb-3 max-h-70 overflow-y-auto bg-[#424242] py-2 text-[#EEEEEE]">
    <li v-for="(item, index) in items" :key="item.checklistItemId" class="flex min-h-10 items-center gap-2 px-4">
      <UCheckbox
        :model-value="item.completed"
        :disabled="disabled || isMutating"
        :aria-label="`${item.content}の完了状態を変更`"
        @update:model-value="toggleItem(item)"
      />
      <div v-if="editingItemId === item.checklistItemId" class="flex flex-1 items-center gap-2 py-1">
        <div class="relative flex-1">
          <UFormField label="チェック項目" class="pb-0">
            <UInput
              v-model="editContent"
              :maxlength="CHECKLIST_ITEM_MAX_LENGTH"
              size="sm"
              autofocus
              :disabled="isUpdating"
              class="w-full"
              @keydown.enter.prevent="saveEdit"
            />
          </UFormField>
        </div>
        <UButton size="sm" variant="ghost" class="text-inherit" :disabled="isUpdating" @click="cancelEditing">取消</UButton>
        <UButton color="primary" size="sm" :loading="isUpdating" :disabled="!canSaveEdit" @click="saveEdit">保存</UButton>
      </div>
      <template v-else>
        <span class="flex-1 text-base" :class="{ 'line-through opacity-60': item.completed }">{{ item.content }}</span>
        <div class="flex gap-1">
          <UButton
            icon="i-mdi-arrow-up"
            size="xs"
            variant="ghost"
            square
            class="text-inherit"
            :disabled="disabled || isMutating || index === 0"
            :aria-label="`${item.content}を上へ移動`"
            @click="moveItem(item, -1)"
          />
          <UButton
            icon="i-mdi-arrow-down"
            size="xs"
            variant="ghost"
            square
            class="text-inherit"
            :disabled="disabled || isMutating || index === items.length - 1"
            :aria-label="`${item.content}を下へ移動`"
            @click="moveItem(item, 1)"
          />
          <UButton
            icon="i-mdi-pencil-outline"
            size="xs"
            variant="ghost"
            square
            class="text-inherit"
            :disabled="disabled || isMutating"
            :aria-label="`${item.content}を編集`"
            @click="startEditing(item)"
          />
          <UButton
            icon="i-mdi-delete-outline"
            color="error"
            size="xs"
            variant="ghost"
            square
            :disabled="disabled || isMutating"
            :aria-label="`${item.content}を削除`"
            @click="openDeleteConfirm(item)"
          />
        </div>
      </template>
    </li>
  </ul>
  <div v-else-if="!isLoading" class="mb-3 text-sm text-muted">まだチェック項目はありません。</div>
  <div class="flex items-start gap-2">
    <div class="relative flex-1">
      <UFormField label="チェック項目を追加">
        <UInput
          v-model="newContent"
          :maxlength="CHECKLIST_ITEM_MAX_LENGTH"
          size="sm"
          :disabled="disabled || isMutating || items.length >= CHECKLIST_ITEM_MAX_COUNT"
          class="w-full"
          @keydown.enter.prevent="addItem"
        />
      </UFormField>
      <FieldCounter :value="newContent" :max="CHECKLIST_ITEM_MAX_LENGTH" />
    </div>
    <UButton color="primary" :loading="isCreating" :disabled="!canAdd" @click="addItem">追加</UButton>
  </div>
  <div v-if="items.length >= CHECKLIST_ITEM_MAX_COUNT" class="mt-1 text-xs text-warning">
    チェック項目は最大{{ CHECKLIST_ITEM_MAX_COUNT }}件です。
  </div>

  <UModal
    :open="deletingItem !== null"
    :dismissible="!isDeleting"
    title="チェック項目を削除しますか？"
    :ui="{ content: 'max-w-120' }"
    @update:open="handleDeleteDialogVisibility"
  >
    <template #body>{{ deletingItem?.content }}</template>
    <template #footer>
      <UButton variant="ghost" :disabled="isDeleting" @click="cancelDelete">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isDeleting" @click="confirmDelete">削除</UButton>
    </template>
  </UModal>
</template>
