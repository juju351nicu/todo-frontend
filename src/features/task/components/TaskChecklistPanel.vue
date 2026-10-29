<script setup lang="ts">
import { toRef } from "vue";

import { checklistControlKey, useTaskChecklist } from "@/features/task/composables/useTaskChecklist";
import {
  CHECKLIST_ITEM_MAX_COUNT,
  CHECKLIST_ITEM_MAX_LENGTH,
} from "@/features/task/constants/taskLimits";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

/**
 * Task Dialog内のチェックリスト。取得・更新・競合回復・フォーカス戻しは`useTaskChecklist`が担当し、
 * このComponentは一覧・入力欄・削除確認Dialogの表示だけを行う。
 */
const props = withDefaults(
  defineProps<{
    /** 対象TaskのProject ID。 */
    projectId: number;
    /** 対象Task ID。変わると一覧を取り直し、編集中・削除確認中の状態を捨てる。 */
    taskId: number;
    /**
     * 参照のみで開くときtrue（担当外のMEMBER、TASK_UPDATEのないaccount、archive済みProject等）。
     * trueの間は追加欄と各行の操作（上下・編集・削除）を出さず、完了のチェックはdisabledで状態だけを示す。更新系APIは呼ばない。
     * 押せない部品が並ぶと操作できない理由が分かりにくいため、出さない。
     */
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const {
  addItem,
  canAdd,
  canSaveEdit,
  cancelDelete,
  completedCount,
  confirmDelete,
  deletingItem,
  discardEditing,
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
  <ul v-if="items.length" class="mb-3 max-h-70 overflow-y-auto rounded-sm bg-muted py-2 text-default">
    <li v-for="(item, index) in items" :key="item.checklistItemId" class="flex min-h-10 items-center gap-2 px-4">
      <UCheckbox
        :model-value="item.completed"
        :disabled="disabled || isMutating"
        :aria-label="`${item.content}の完了状態を変更`"
        :data-checklist-control="checklistControlKey(item.checklistItemId, 'toggle')"
        @update:model-value="toggleItem(item)"
      />
      <div v-if="editingItemId === item.checklistItemId" class="flex flex-1 items-center gap-2 py-1">
        <div class="relative flex-1">
          <UFormField label="チェック項目" class="pb-0">
            <!-- Escは編集の取消だけにする。preventDefaultしないとTask Dialog（UModal）もEscで閉じ、編集中の本文ごと失われるため。 -->
            <UInput
              v-model="editContent"
              :maxlength="CHECKLIST_ITEM_MAX_LENGTH"
              size="sm"
              autofocus
              :disabled="isUpdating"
              class="w-full"
              @keydown.enter.prevent="saveEdit"
              @keydown.esc.prevent="discardEditing"
            />
          </UFormField>
        </div>
        <UButton size="sm" variant="ghost" class="text-inherit" :disabled="isUpdating" @click="discardEditing">取消</UButton>
        <UButton color="primary" size="sm" :loading="isUpdating" :disabled="!canSaveEdit" @click="saveEdit">保存</UButton>
      </div>
      <template v-else>
        <span class="flex-1 text-base" :class="{ 'line-through opacity-60': item.completed }">{{ item.content }}</span>
        <div v-if="!disabled" class="flex gap-1">
          <UButton
            icon="i-mdi-arrow-up"
            size="xs"
            variant="ghost"
            square
            class="text-inherit"
            :disabled="disabled || isMutating || index === 0"
            :aria-label="`${item.content}を上へ移動`"
            :data-checklist-control="checklistControlKey(item.checklistItemId, 'move-up')"
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
            :data-checklist-control="checklistControlKey(item.checklistItemId, 'move-down')"
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
            :data-checklist-control="checklistControlKey(item.checklistItemId, 'edit')"
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
  <div v-if="!disabled" class="flex items-start gap-2">
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
  <div v-if="!disabled && items.length >= CHECKLIST_ITEM_MAX_COUNT" class="mt-1 text-xs text-warning">
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
