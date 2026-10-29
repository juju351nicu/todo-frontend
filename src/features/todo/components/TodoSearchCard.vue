<script setup lang="ts">
import { formatTodoSearchDate } from "@/features/todo/utils/todoDisplay";

/**
 * Todo一覧・Todoカレンダー共通の検索条件card。タイトルと完了状態（`"0"`:未完了、`"1"`:完了）を親composableの状態へ反映し、
 * 検索の実行は`search`で親へ通知する。
 */
const searchTitle = defineModel<string>("searchTitle", { required: true });
const selectedDoneFlag = defineModel<string[]>("selectedDoneFlag", { required: true });

const emit = defineEmits<{
  search: [];
}>();

const DONE_FLAG_OPTIONS = [
  { value: "0", label: "未完了のみ" },
  { value: "1", label: "完了のみ" },
] as const;

/** 完了状態のcheckboxを切り替える。検索条件（`done_flag_values`）へそのまま渡せるよう、選択値の配列として保持する。 */
const toggleDoneFlag = (value: string, checked: boolean): void => {
  const others = selectedDoneFlag.value.filter((flag) => flag !== value);
  selectedDoneFlag.value = checked ? [...others, value] : others;
};

const today = formatTodoSearchDate();
</script>

<template>
  <UCard class="mx-auto max-w-250">
    <template #header>
      Todo検索
      <div class="-m-3 flex flex-wrap items-center text-base font-normal tracking-normal">
        <div class="flex-1 p-3">
          <UFormField label="タイトル" class="pb-0">
            <UInput v-model="searchTitle" placeholder="タイトルの一部" class="w-full" />
          </UFormField>
        </div>
        <div v-for="option in DONE_FLAG_OPTIONS" :key="option.value" class="flex-1 p-3">
          <UCheckbox
            :model-value="selectedDoneFlag.includes(option.value)"
            :label="option.label"
            @update:model-value="toggleDoneFlag(option.value, $event === true)"
          />
        </div>
      </div>
      <div class="text-end text-sm font-normal tracking-normal text-muted">{{ today }}</div>
    </template>
    <div class="text-end">
      <UButton color="success" @click="emit('search')">検索</UButton>
    </div>
  </UCard>
</template>
