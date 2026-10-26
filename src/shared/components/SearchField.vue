<script setup lang="ts">
/**
 * 一覧の絞り込みに使う検索欄。移行前のVuetify v-text-field（compact・虫眼鏡アイコン・clearable・hide-details）と同じ表示で、
 * 入力がある場合だけ右端にクリアbuttonを出す。クリアすると空文字にする（nullにはしない）。
 */
withDefaults(
  defineProps<{
    label: string;
    placeholder?: string;
  }>(),
  { placeholder: undefined },
);

const searchText = defineModel<string>({ required: true });
</script>

<template>
  <UFormField :label="label" class="pb-0 text-base font-normal tracking-normal">
    <UInput v-model="searchText" :placeholder="placeholder" icon="i-mdi-magnify" size="sm" class="w-full">
      <template v-if="searchText" #trailing>
        <UButton
          icon="i-mdi-close-circle"
          variant="ghost"
          size="xs"
          square
          class="text-muted"
          aria-label="検索条件をクリア"
          @click="searchText = ''"
        />
      </template>
    </UInput>
  </UFormField>
</template>
