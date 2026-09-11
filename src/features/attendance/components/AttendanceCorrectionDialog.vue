<script setup lang="ts">
import type { AttendanceCorrectionForm } from "@/features/attendance/types/attendance";

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
  <v-dialog
    :model-value="modelValue"
    max-width="980"
    persistent
    @update:model-value="!$event && $emit('close')"
  >
    <v-card>
      <v-card-title>勤怠修正申請（{{ workDate }}）</v-card-title>
      <v-card-subtitle>
        承認後は、ここで入力した勤務・休憩区間で対象日全体を置き換えます。
      </v-card-subtitle>
      <v-card-text class="attendance-correction-dialog-body">
        <v-textarea
          :model-value="form.reason"
          label="修正理由（必須）"
          maxlength="1000"
          rows="2"
          counter
          @update:model-value="$emit('updateReason', String($event ?? ''))"
        />
        <v-textarea
          :model-value="form.note"
          label="承認後のメモ"
          maxlength="1000"
          rows="2"
          counter
          @update:model-value="$emit('updateNote', String($event ?? ''))"
        />

        <v-card
          v-for="(workPeriod, workIndex) in form.workPeriods"
          :key="workIndex"
          variant="outlined"
          class="mb-4"
        >
          <v-card-title class="d-flex align-center text-subtitle-1">
            勤務区間 {{ workIndex + 1 }}
            <v-spacer />
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              :aria-label="`勤務区間${workIndex + 1}を削除`"
              @click="$emit('removeWork', workIndex)"
            />
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="workPeriod.startedAt"
                  type="datetime-local"
                  step="1"
                  label="出勤日時"
                  @update:model-value="$emit('updateWorkStartedAt', workIndex, String($event ?? ''))"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="workPeriod.endedAt"
                  type="datetime-local"
                  step="1"
                  label="退勤日時"
                  @update:model-value="$emit('updateWorkEndedAt', workIndex, String($event ?? ''))"
                />
              </v-col>
            </v-row>

            <v-sheet
              v-for="(breakPeriod, breakIndex) in workPeriod.breakPeriods"
              :key="breakIndex"
              rounded
              color="surface-variant"
              class="pa-3 mb-2"
            >
              <div class="d-flex align-center mb-2">
                <strong>休憩 {{ breakIndex + 1 }}</strong>
                <v-spacer />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  color="error"
                  :aria-label="`休憩${breakIndex + 1}を削除`"
                  @click="$emit('removeBreak', workIndex, breakIndex)"
                />
              </div>
              <v-row dense>
                <v-col cols="12" sm="6">
                  <v-text-field
                    :model-value="breakPeriod.startedAt"
                    type="datetime-local"
                    step="1"
                    label="休憩開始日時"
                    hide-details
                    @update:model-value="$emit('updateBreakStartedAt', workIndex, breakIndex, String($event ?? ''))"
                  />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field
                    :model-value="breakPeriod.endedAt"
                    type="datetime-local"
                    step="1"
                    label="休憩終了日時"
                    hide-details
                    @update:model-value="$emit('updateBreakEndedAt', workIndex, breakIndex, String($event ?? ''))"
                  />
                </v-col>
              </v-row>
            </v-sheet>
            <v-btn
              variant="tonal"
              prepend-icon="mdi-coffee-outline"
              :disabled="workPeriod.breakPeriods.length >= 20"
              @click="$emit('addBreak', workIndex)"
            >
              休憩を追加
            </v-btn>
          </v-card-text>
        </v-card>

        <v-btn
          variant="outlined"
          prepend-icon="mdi-plus"
          :disabled="form.workPeriods.length >= 20"
          @click="$emit('addWork')"
        >
          勤務区間を追加
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="submitting" @click="$emit('close')">キャンセル</v-btn>
        <v-btn
          color="primary"
          :loading="submitting"
          prepend-icon="mdi-send"
          @click="$emit('submit')"
        >
          申請する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.attendance-correction-dialog-body {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
