<script setup lang="ts">
/**
 * 入力欄の右下に「入力文字数 / 上限」を表示する。入力欄の右下に重ねて置くため、
 * `relative`を指定した親要素の中で、`UFormField`の直後に配置する。
 */
defineProps<{
  value: string | null | undefined;
  max: number;
}>();
</script>

<template>
  <span class="pointer-events-none absolute end-4 bottom-0.5 text-xs text-muted">{{ value?.length ?? 0 }} / {{ max }}</span>
</template>
