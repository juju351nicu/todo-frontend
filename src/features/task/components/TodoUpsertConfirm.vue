<script setup lang="ts">
import { computed } from "vue";

import { buildTodoConfirmItems, type TodoDetailForm } from "@/features/task/utils/taskForm";

/** 登録・更新前に表示するTodoフォーム。 */
const props = defineProps<{
  todoForm: TodoDetailForm;
}>();

/** 保存せず戻る操作と、確認済みフォームの保存要求を親画面へ通知する。 */
const emit = defineEmits<{
  "close-modal": [];
  "confirm-submit": [];
}>();

const isUpdate = computed(() => props.todoForm.todoId > 0);
const confirmItems = computed(() => buildTodoConfirmItems(props.todoForm));

/**
 * Dialogを閉じる操作（戻る・Esc・背景のクリック）を親画面へ伝える。
 * 表示の有無は親画面の`v-if`が決めるため、ここでは開閉状態を持たない。
 *
 * @param open UModalが通知する開閉状態
 */
const handleOpenChange = (open: boolean): void => {
  if (!open) {
    emit("close-modal");
  }
};
</script>

<template>
  <!--
    ほかの画面と同じUModalにし、幅の狭い画面（390px）でも切れず、Escで閉じられ、Dialogとして読み上げられるようにする。
  -->
  <UModal
    :open="true"
    :title="isUpdate ? '更新内容の確認' : '登録内容の確認'"
    description="この内容で保存します。"
    :ui="{ content: 'max-w-140' }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <template v-for="item in confirmItems" :key="item.label">
          <dt class="text-sm text-muted">{{ item.label }}</dt>
          <dd class="break-words whitespace-pre-wrap">{{ item.value }}</dd>
        </template>
      </dl>
    </template>
    <template #footer>
      <UButton variant="ghost" @click="emit('close-modal')">戻る</UButton>
      <UButton color="primary" @click="emit('confirm-submit')">{{ isUpdate ? "更新" : "登録" }}</UButton>
    </template>
  </UModal>
</template>
