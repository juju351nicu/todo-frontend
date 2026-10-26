<script setup lang="ts">
import type { AttendanceCorrectionForm } from "@/features/attendance/types/attendance";
import FieldCounter from "@/shared/components/FieldCounter.vue";

/** 本人画面が所有する修正入力を表示し、全変更と確定操作をEventで返す。 */
defineProps<{
  form: AttendanceCorrectionForm;
  modelValue: boolean;
  submitting: boolean;
  workDate: string;
}>();

/** 親composableへ入力変更を返し、このComponent内でAPIや共有状態を更新しない。 */
defineEmits<{
  addBreak: [workIndex: number];
  addWork: [];
  close: [];
  removeBreak: [workIndex: number, breakIndex: number];
  removeWork: [workIndex: number];
  submit: [];
  updateBreakEndedAt: [workIndex: number, breakIndex: number, value: string];
  updateBreakStartedAt: [workIndex: number, breakIndex: number, value: string];
  updateNote: [value: string];
  updateReason: [value: string];
  updateWorkEndedAt: [workIndex: number, value: string];
  updateWorkStartedAt: [workIndex: number, value: string];
}>();
</script>

<template>
  <!-- 入力途中の申請を誤って破棄しないよう、Vuetifyのpersistentと同じく外側クリックやEscでは閉じない。 -->
  <UModal
    :open="modelValue"
    :dismissible="false"
    :title="`勤怠修正申請（${workDate}）`"
    description="承認後は、ここで入力した勤務・休憩区間で対象日全体を置き換えます。"
    :ui="{ content: 'max-w-245', body: 'max-h-[70vh] overflow-y-auto' }"
  >
    <template #body>
      <div class="relative">
        <UFormField label="修正理由（必須）">
          <UTextarea
            :model-value="form.reason"
            :maxlength="1000"
            :rows="2"
            class="w-full"
            @update:model-value="$emit('updateReason', String($event ?? ''))"
          />
        </UFormField>
        <FieldCounter :value="form.reason" :max="1000" />
      </div>
      <div class="relative">
        <UFormField label="承認後のメモ">
          <UTextarea
            :model-value="form.note"
            :maxlength="1000"
            :rows="2"
            class="w-full"
            @update:model-value="$emit('updateNote', String($event ?? ''))"
          />
        </UFormField>
        <FieldCounter :value="form.note" :max="1000" />
      </div>

      <UCard v-for="(workPeriod, workIndex) in form.workPeriods" :key="workIndex" variant="outline" class="mb-4">
        <template #header>
          <div class="flex items-center text-base font-normal">
            勤務区間 {{ workIndex + 1 }}
            <UButton
              icon="i-mdi-delete-outline"
              variant="ghost"
              color="error"
              square
              class="ms-auto"
              :aria-label="`勤務区間${workIndex + 1}を削除`"
              @click="$emit('removeWork', workIndex)"
            />
          </div>
        </template>
        <div class="-m-1 flex flex-wrap">
          <div class="w-full p-1 sm:w-1/2">
            <UFormField label="出勤日時">
              <UInput
                :model-value="workPeriod.startedAt"
                type="datetime-local"
                step="1"
                class="w-full"
                @update:model-value="$emit('updateWorkStartedAt', workIndex, String($event ?? ''))"
              />
            </UFormField>
          </div>
          <div class="w-full p-1 sm:w-1/2">
            <UFormField label="退勤日時">
              <UInput
                :model-value="workPeriod.endedAt"
                type="datetime-local"
                step="1"
                class="w-full"
                @update:model-value="$emit('updateWorkEndedAt', workIndex, String($event ?? ''))"
              />
            </UFormField>
          </div>
        </div>

        <div
          v-for="(breakPeriod, breakIndex) in workPeriod.breakPeriods"
          :key="breakIndex"
          class="mb-2 rounded-sm bg-muted p-3 text-default"
        >
          <div class="mb-2 flex items-center">
            <strong>休憩 {{ breakIndex + 1 }}</strong>
            <UButton
              icon="i-mdi-delete-outline"
              size="sm"
              variant="ghost"
              color="error"
              square
              class="ms-auto"
              :aria-label="`休憩${breakIndex + 1}を削除`"
              @click="$emit('removeBreak', workIndex, breakIndex)"
            />
          </div>
          <div class="-m-1 flex flex-wrap">
            <div class="w-full p-1 sm:w-1/2">
              <UFormField label="休憩開始日時" class="pb-0">
                <UInput
                  :model-value="breakPeriod.startedAt"
                  type="datetime-local"
                  step="1"
                  class="w-full"
                  @update:model-value="$emit('updateBreakStartedAt', workIndex, breakIndex, String($event ?? ''))"
                />
              </UFormField>
            </div>
            <div class="w-full p-1 sm:w-1/2">
              <UFormField label="休憩終了日時" class="pb-0">
                <UInput
                  :model-value="breakPeriod.endedAt"
                  type="datetime-local"
                  step="1"
                  class="w-full"
                  @update:model-value="$emit('updateBreakEndedAt', workIndex, breakIndex, String($event ?? ''))"
                />
              </UFormField>
            </div>
          </div>
        </div>
        <UButton
          variant="soft"
          icon="i-mdi-coffee-outline"
          :disabled="workPeriod.breakPeriods.length >= 20"
          @click="$emit('addBreak', workIndex)"
        >
          休憩を追加
        </UButton>
      </UCard>

      <UButton
        variant="outline"
        icon="i-mdi-plus"
        :disabled="form.workPeriods.length >= 20"
        @click="$emit('addWork')"
      >
        勤務区間を追加
      </UButton>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="submitting" @click="$emit('close')">キャンセル</UButton>
      <UButton color="primary" variant="ghost" :loading="submitting" icon="i-mdi-send" @click="$emit('submit')">
        申請する
      </UButton>
    </template>
  </UModal>
</template>
