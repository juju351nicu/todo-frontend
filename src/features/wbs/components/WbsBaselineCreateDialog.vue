<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { WbsBaselineCreateForm } from "@/features/wbs/types/wbs";

/** baseline作成Dialogへ親画面から渡す確定状態。 */
interface Props {
  open: boolean;
  isSaving: boolean;
  errorMessages: string[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  save: [form: WbsBaselineCreateForm];
}>();
const form = ref<WbsBaselineCreateForm>({ name: "", description: "" });
const canSubmit = computed(
  () => !props.isSaving && form.value.name.trim().length > 0
);

/** Dialogを開くたびに、前回の保存済みまたは破棄済み入力を初期化する。 */
const resetFormWhenOpened = (open: boolean): void => {
  if (open) {
    form.value = { name: "", description: "" };
  }
};

watch(() => props.open, resetFormWhenOpened, { immediate: true });

/** 保存中でなければ未確定入力を破棄するよう親composableへ通知する。 */
const closeDialog = (): void => {
  if (!props.isSaving) {
    emit("close");
  }
};

/** Vuetifyが外側クリック等で閉じようとした場合だけ通常のclose処理へ渡す。 */
const handleDialogModelValue = (value: boolean): void => {
  if (!value) {
    closeDialog();
  }
};

/** 入力中の値を複製し、最終検証とAPI送信を担当する親composableへ渡す。 */
const submitForm = (): void => {
  if (canSubmit.value) {
    emit("save", { ...form.value });
  }
};
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="680"
    :persistent="isSaving"
    @update:model-value="handleDialogModelValue"
  >
    <v-card>
      <v-card-title>WBS baselineを作成</v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>
        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          現在のTask予定、依存関係、日別予定工数を変更不能な比較用snapshotとして保存します。
        </v-alert>
        <v-form @submit.prevent="submitForm">
          <v-text-field
            v-model="form.name"
            label="baseline名"
            maxlength="100"
            counter="100"
            :disabled="isSaving"
            autofocus
          />
          <v-textarea
            v-model="form.description"
            label="説明（任意）"
            maxlength="1000"
            counter="1000"
            rows="4"
            :disabled="isSaving"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSaving" @click="closeDialog">キャンセル</v-btn>
        <v-btn
          color="primary"
          :loading="isSaving"
          :disabled="!canSubmit"
          @click="submitForm"
        >
          作成
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
