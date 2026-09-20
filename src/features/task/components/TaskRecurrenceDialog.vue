<script setup lang="ts">
import { computed, ref, toRef } from "vue";

import type {
  ProjectMember,
  TaskPriority,
  TaskStatus,
} from "@/features/project/types/project";
import { useTaskRecurrences } from "@/features/task/composables/useTaskRecurrences";
import type {
  TaskRecurrenceFrequency,
  TaskRecurrenceGenerationStatus,
  TaskRecurrenceStatus,
  TaskRecurrenceWeekday,
} from "@/features/task/types/taskRecurrence";

const props = withDefaults(
  defineProps<{
    projectId: number;
    members: ProjectMember[];
    statuses: TaskStatus[];
    canCreate?: boolean;
    canUpdate?: boolean;
    projectActive?: boolean;
  }>(),
  { canCreate: false, canUpdate: false, projectActive: false }
);

const isOpen = ref(false);
const isArchiveConfirmOpen = ref(false);
const {
  archiveRule,
  beginCreating,
  beginEditing,
  cancelForm,
  createRule,
  creationMode,
  errorMessage,
  form,
  generations,
  isArchiving,
  isCreating,
  isEditing,
  isLoading,
  isLoadingGenerations,
  isLoadingTemplates,
  isMutating,
  isSaving,
  loadGenerations,
  loadRules,
  loadTemplates,
  retryGeneration,
  retryingGenerationId,
  rules,
  saveRule,
  selectRule,
  selectedRule,
  successMessage,
  templates,
} = useTaskRecurrences(toRef(props, "projectId"));

const memberOptions = computed(() =>
  props.members.map((member) => ({
    title: `アカウントID: ${member.accountId}（${member.projectRole}）`,
    value: member.accountId,
  }))
);
const statusOptions = computed(() =>
  props.statuses
    .filter((status) => !status.completed)
    .map((status) => ({ title: status.name, value: status.taskStatusId }))
);
const canEditSelected = computed(
  () =>
    props.canUpdate &&
    props.projectActive &&
    selectedRule.value !== null &&
    ["ACTIVE", "PAUSED", "BLOCKED"].includes(selectedRule.value.status)
);
const canArchiveSelected = computed(
  () =>
    props.canUpdate &&
    props.projectActive &&
    selectedRule.value !== null &&
    selectedRule.value.status !== "ARCHIVED"
);

const priorityOptions: Array<{ title: string; value: TaskPriority }> = [
  { title: "低", value: 1 },
  { title: "中", value: 2 },
  { title: "高", value: 3 },
];
const frequencyOptions: Array<{
  title: string;
  value: TaskRecurrenceFrequency;
}> = [
  { title: "日次", value: "DAILY" },
  { title: "週次", value: "WEEKLY" },
  { title: "月次", value: "MONTHLY" },
];
const weekdayOptions: Array<{
  title: string;
  value: TaskRecurrenceWeekday;
}> = [
  { title: "月", value: "MONDAY" },
  { title: "火", value: "TUESDAY" },
  { title: "水", value: "WEDNESDAY" },
  { title: "木", value: "THURSDAY" },
  { title: "金", value: "FRIDAY" },
  { title: "土", value: "SATURDAY" },
  { title: "日", value: "SUNDAY" },
];
const lifecycleOptions = [
  { title: "有効", value: "ACTIVE" },
  { title: "一時停止", value: "PAUSED" },
] as const;

const statusLabels: Record<TaskRecurrenceStatus, string> = {
  ACTIVE: "有効",
  PAUSED: "一時停止",
  BLOCKED: "要修正",
  ENDED: "終了",
  ARCHIVED: "アーカイブ済み",
};
const statusColors: Record<TaskRecurrenceStatus, string> = {
  ACTIVE: "success",
  PAUSED: "warning",
  BLOCKED: "error",
  ENDED: "default",
  ARCHIVED: "default",
};
const generationStatusLabels: Record<TaskRecurrenceGenerationStatus, string> = {
  PENDING: "待機中",
  PROCESSING: "処理中",
  RETRY_WAIT: "再試行待ち",
  SUCCEEDED: "成功",
  FAILED: "失敗",
  SKIPPED: "スキップ",
};
const generationStatusColors: Record<
  TaskRecurrenceGenerationStatus,
  string
> = {
  PENDING: "info",
  PROCESSING: "info",
  RETRY_WAIT: "warning",
  SUCCEEDED: "success",
  FAILED: "error",
  SKIPPED: "default",
};
const blockedReasonLabels: Record<string, string> = {
  PROJECT_ARCHIVED: "Projectがアーカイブされています。",
  RULE_OWNER_INACTIVE: "規則の所有者が無効です。",
  RULE_OWNER_NOT_PROJECT_MEMBER: "規則の所有者がProjectに参加していません。",
  ASSIGNEE_NOT_PROJECT_MEMBER: "担当者がProjectに参加していません。",
  ASSIGNEE_ID_OUT_OF_RANGE: "担当者IDをTaskへ保存できません。",
  TASK_STATUS_UNAVAILABLE: "指定したBoard列を利用できません。",
  FEATURE_NOT_ENTITLED: "規則の所有者に繰り返しTaskの機能資格がありません。",
  TASK_POSITION_CONFLICT: "Taskの配置位置が競合しました。",
  RETRY_EXHAUSTED: "自動再試行の上限へ到達しました。",
};

/** Dialogを開くたびにarchive済みを含む最新規則一覧を取得する。 */
const open = async (): Promise<void> => {
  isOpen.value = true;
  await loadRules();
};

/** Projectの先頭memberと先頭未完了列を既定値にして作成を始める。 */
const startCreating = (): void => {
  beginCreating(
    memberOptions.value[0]?.value ?? null,
    statusOptions.value[0]?.value ?? null
  );
};

/** 作成元切替時に不要な上書き値を除き、Template一覧を必要時だけ取得する。 */
const changeCreationMode = async (
  value: "DIRECT" | "TEMPLATE" | null
): Promise<void> => {
  if (value === null) return;
  creationMode.value = value;
  if (value === "TEMPLATE") {
    form.value.assigneeAccountId = null;
    form.value.taskStatusId = null;
    if (templates.value.length === 0) await loadTemplates();
    return;
  }
  form.value.assigneeAccountId ??= memberOptions.value[0]?.value ?? null;
  form.value.taskStatusId ??= statusOptions.value[0]?.value ?? null;
};

/** 選択規則をarchiveし、成功・競合後の最新状態を表示する。 */
const confirmArchive = async (): Promise<void> => {
  await archiveRule();
  isArchiveConfirmOpen.value = false;
};

/** 頻度と間隔を一覧・詳細向けの短い日本語へ変換する。 */
const formatSchedule = (
  frequency: TaskRecurrenceFrequency,
  intervalCount: number,
  weekdays: TaskRecurrenceWeekday[],
  monthlyDay: number | null
): string => {
  if (frequency === "DAILY") return `${intervalCount}日ごと`;
  if (frequency === "MONTHLY") {
    return `${intervalCount}か月ごと・${monthlyDay ?? "-"}日`;
  }
  const labels = weekdays
    .map((weekday) => weekdayOptions.find((item) => item.value === weekday)?.title)
    .filter((label): label is string => label !== undefined)
    .join("・");
  return `${intervalCount}週ごと・${labels}`;
};

/** ISO時刻を利用者のlocaleで読める日時へ変換する。 */
const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "-";

/** 安定error codeを運用者向け説明へ変換し、未知codeも隠さず表示する。 */
const formatErrorCode = (value: string | null): string =>
  value ? blockedReasonLabels[value] ?? value : "-";
</script>

<template>
  <v-btn prepend-icon="mdi-calendar-sync-outline" variant="tonal" @click="open">
    繰り返しTask
  </v-btn>

  <v-dialog v-model="isOpen" max-width="1280" :persistent="isMutating">
    <v-card>
      <v-card-title class="d-flex align-center">
        繰り返しTask
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          :disabled="isMutating"
          aria-label="繰り返しTaskを閉じる"
          @click="isOpen = false"
        />
      </v-card-title>
      <v-card-text>
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
        <v-alert v-if="!projectActive" type="info" density="compact" class="mb-3">
          アーカイブ済みProjectでは規則と生成履歴を参照できますが、変更はできません。
        </v-alert>
        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />

        <v-row>
          <v-col cols="12" md="4">
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-1 font-weight-bold">規則一覧</div>
              <v-spacer />
              <v-btn
                v-if="canCreate && projectActive"
                size="small"
                color="primary"
                prepend-icon="mdi-plus"
                :disabled="isMutating"
                @click="startCreating"
              >
                新規作成
              </v-btn>
            </div>
            <v-list v-if="rules.length" density="compact" border rounded>
              <v-list-item
                v-for="rule in rules"
                :key="rule.taskRecurrenceRuleId"
                :active="selectedRule?.taskRecurrenceRuleId === rule.taskRecurrenceRuleId"
                :title="rule.title"
                :subtitle="formatSchedule(rule.frequency, rule.intervalCount, rule.weekdays, rule.monthlyDay)"
                @click="selectRule(rule)"
              >
                <template #append>
                  <v-chip :color="statusColors[rule.status]" size="x-small">
                    {{ statusLabels[rule.status] }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="!isLoading" class="text-body-2 text-medium-emphasis pa-3">
              繰り返しTask規則はありません。
            </div>
          </v-col>

          <v-col cols="12" md="8">
            <v-form v-if="isCreating || isEditing" @submit.prevent="isCreating ? createRule() : saveRule()">
              <div class="d-flex align-center mb-3">
                <h2 class="text-h6">
                  {{ isCreating ? "規則を作成" : "規則を編集" }}
                </h2>
                <v-spacer />
                <v-chip v-if="isEditing && selectedRule" size="small">
                  version {{ selectedRule.version }}
                </v-chip>
              </div>

              <v-btn-toggle
                v-if="isCreating"
                :model-value="creationMode"
                mandatory
                color="primary"
                class="mb-4"
                @update:model-value="changeCreationMode"
              >
                <v-btn value="DIRECT">直接入力</v-btn>
                <v-btn value="TEMPLATE">Task Template</v-btn>
              </v-btn-toggle>

              <template v-if="!isCreating || creationMode === 'DIRECT'">
                <v-text-field
                  v-model="form.title"
                  label="Taskタイトル"
                  maxlength="45"
                  counter
                  :disabled="isMutating"
                />
                <v-textarea
                  v-model="form.detail"
                  label="Task詳細"
                  maxlength="1000"
                  counter
                  rows="3"
                  :disabled="isMutating"
                />
                <v-row>
                  <v-col cols="12" sm="4">
                    <v-select v-model="form.priority" label="優先度" :items="priorityOptions" :disabled="isMutating" />
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="form.plannedEffortMinutes"
                      label="予定工数（分）"
                      type="number"
                      min="0"
                      :disabled="isMutating"
                    />
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-text-field
                      v-model.number="form.dueOffsetDays"
                      label="期限オフセット（日）"
                      type="number"
                      min="0"
                      max="365"
                      :disabled="isMutating"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select v-model="form.assigneeAccountId" label="担当者" :items="memberOptions" :disabled="isMutating" />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select v-model="form.taskStatusId" label="未完了Board列" :items="statusOptions" :disabled="isMutating" />
                  </v-col>
                </v-row>
                <v-combobox
                  v-model="form.checklistContents"
                  label="チェック項目"
                  hint="入力後にEnterで項目を追加します（最大50件）"
                  persistent-hint
                  multiple
                  chips
                  closable-chips
                  :disabled="isMutating"
                  class="mb-3"
                />
              </template>

              <template v-else>
                <v-progress-linear v-if="isLoadingTemplates" indeterminate class="mb-3" />
                <v-select
                  v-model="form.taskTemplateId"
                  label="本人所有Task Template"
                  :items="templates"
                  item-title="name"
                  item-value="taskTemplateId"
                  :disabled="isMutating || isLoadingTemplates"
                  no-data-text="利用できるTask Templateがありません"
                />
                <v-row>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="form.assigneeAccountId"
                      label="担当者上書き"
                      :items="memberOptions"
                      clearable
                      persistent-hint
                      hint="未指定時はTemplate既定値、さらに未指定なら作成者"
                      :disabled="isMutating"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="form.taskStatusId"
                      label="Board列上書き"
                      :items="statusOptions"
                      clearable
                      persistent-hint
                      hint="未指定時はTemplate既定列"
                      :disabled="isMutating"
                    />
                  </v-col>
                </v-row>
              </template>

              <v-divider class="my-4" />
              <div class="text-subtitle-1 font-weight-bold mb-3">Schedule</div>
              <v-row>
                <v-col cols="12" sm="4">
                  <v-select v-model="form.frequency" label="頻度" :items="frequencyOptions" :disabled="isMutating" />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="form.intervalCount"
                    label="繰り返し間隔"
                    type="number"
                    min="1"
                    :max="form.frequency === 'DAILY' ? 365 : form.frequency === 'WEEKLY' ? 52 : 24"
                    :disabled="isMutating"
                  />
                </v-col>
                <v-col v-if="form.frequency === 'MONTHLY'" cols="12" sm="4">
                  <v-text-field
                    v-model.number="form.monthlyDay"
                    label="毎月の日付"
                    type="number"
                    min="1"
                    max="31"
                    hint="存在しない日は月末に丸めます"
                    persistent-hint
                    :disabled="isMutating"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="form.firstOccurrenceDate"
                    label="最初の発生日"
                    type="date"
                    :readonly="isEditing"
                    :disabled="isMutating"
                    :hint="isEditing ? '作成時のanchorは変更できません' : undefined"
                    :persistent-hint="isEditing"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field v-model="form.endDate" label="終了日（任意）" type="date" clearable :disabled="isMutating" />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="form.generationLeadDays"
                    label="生成先行日数"
                    type="number"
                    min="0"
                    max="90"
                    hint="発生日の何日前にTaskを作るか"
                    persistent-hint
                    :disabled="isMutating"
                  />
                </v-col>
                <v-col v-if="isEditing" cols="12" sm="4">
                  <v-select v-model="form.status" label="状態" :items="lifecycleOptions" :disabled="isMutating" />
                </v-col>
              </v-row>
              <div v-if="form.frequency === 'WEEKLY'" class="mb-4">
                <div class="text-body-2 mb-1">発生曜日</div>
                <v-chip-group v-model="form.weekdays" multiple selected-class="text-primary" :disabled="isMutating">
                  <v-chip v-for="weekday in weekdayOptions" :key="weekday.value" :value="weekday.value" filter>
                    {{ weekday.title }}
                  </v-chip>
                </v-chip-group>
              </div>

              <div class="d-flex justify-end ga-2 mt-4">
                <v-btn :disabled="isMutating" @click="cancelForm">キャンセル</v-btn>
                <v-btn type="submit" color="primary" :loading="isSaving">
                  {{ isCreating ? "作成" : "更新" }}
                </v-btn>
              </div>
            </v-form>

            <div v-else-if="selectedRule">
              <div class="d-flex align-center flex-wrap ga-2 mb-3">
                <h2 class="text-h6">{{ selectedRule.title }}</h2>
                <v-chip :color="statusColors[selectedRule.status]" size="small">
                  {{ statusLabels[selectedRule.status] }}
                </v-chip>
                <v-chip size="small">version {{ selectedRule.version }}</v-chip>
                <v-spacer />
                <v-btn
                  v-if="canEditSelected"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-pencil-outline"
                  :disabled="isMutating"
                  @click="beginEditing"
                >
                  編集・停止
                </v-btn>
                <v-btn
                  v-if="canArchiveSelected"
                  size="small"
                  variant="text"
                  color="error"
                  prepend-icon="mdi-archive-outline"
                  :disabled="isMutating"
                  @click="isArchiveConfirmOpen = true"
                >
                  アーカイブ
                </v-btn>
              </div>
              <v-alert v-if="selectedRule.status === 'BLOCKED'" type="error" density="compact" class="mb-3">
                {{ formatErrorCode(selectedRule.blockedReason) }} 入力や参照先を修正して「有効」で更新してください。
              </v-alert>
              <p class="text-body-2 recurrence-detail mb-3">{{ selectedRule.detail }}</p>
              <v-row dense class="mb-2">
                <v-col cols="12" sm="6"><strong>Schedule:</strong> {{ formatSchedule(selectedRule.frequency, selectedRule.intervalCount, selectedRule.weekdays, selectedRule.monthlyDay) }}</v-col>
                <v-col cols="12" sm="6"><strong>次回発生日:</strong> {{ selectedRule.nextOccurrenceDate ?? "-" }}</v-col>
                <v-col cols="12" sm="6"><strong>期間:</strong> {{ selectedRule.firstOccurrenceDate }} ～ {{ selectedRule.endDate ?? "終了日なし" }}</v-col>
                <v-col cols="12" sm="6"><strong>生成:</strong> 発生日の{{ selectedRule.generationLeadDays }}日前</v-col>
                <v-col cols="12" sm="6"><strong>担当者:</strong> アカウントID {{ selectedRule.assigneeAccountId }}</v-col>
                <v-col cols="12" sm="6"><strong>期限:</strong> 発生日 +{{ selectedRule.dueOffsetDays }}日</v-col>
                <v-col cols="12" sm="6"><strong>予定工数:</strong> {{ selectedRule.plannedEffortMinutes }}分</v-col>
                <v-col cols="12" sm="6"><strong>作成元:</strong> {{ selectedRule.sourceTaskTemplateId === null ? "直接入力" : `Task Template #${selectedRule.sourceTaskTemplateId}` }}</v-col>
              </v-row>
              <v-list v-if="selectedRule.checklistItems.length" density="compact" border rounded class="mb-4">
                <v-list-item
                  v-for="item in selectedRule.checklistItems"
                  :key="item.position"
                  prepend-icon="mdi-checkbox-blank-outline"
                  :title="item.content"
                />
              </v-list>

              <v-divider class="my-4" />
              <div class="d-flex align-center mb-2">
                <div class="text-subtitle-1 font-weight-bold">生成履歴（直近100件）</div>
                <v-spacer />
                <v-btn
                  size="small"
                  variant="text"
                  prepend-icon="mdi-refresh"
                  :loading="isLoadingGenerations"
                  :disabled="isMutating"
                  @click="loadGenerations"
                >
                  再読込
                </v-btn>
              </div>
              <v-progress-linear v-if="isLoadingGenerations" indeterminate class="mb-2" />
              <div class="generation-table">
                <v-table v-if="generations.length" density="compact">
                  <thead>
                    <tr>
                      <th>発生日</th>
                      <th>状態</th>
                      <th>生成Task</th>
                      <th>試行</th>
                      <th>次回／エラー</th>
                      <th aria-label="操作"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="generation in generations" :key="generation.taskRecurrenceGenerationId">
                      <td>{{ generation.occurrenceDate }}</td>
                      <td>
                        <v-chip :color="generationStatusColors[generation.status]" size="x-small">
                          {{ generationStatusLabels[generation.status] }}
                        </v-chip>
                      </td>
                      <td>{{ generation.generatedTaskId === null ? "-" : `#${generation.generatedTaskId}` }}</td>
                      <td>{{ generation.attemptCount }}</td>
                      <td>
                        <span v-if="generation.lastErrorCode">{{ formatErrorCode(generation.lastErrorCode) }}</span>
                        <span v-else>{{ formatDateTime(generation.nextRetryAt) }}</span>
                      </td>
                      <td class="text-right">
                        <v-btn
                          v-if="generation.status === 'FAILED' && canUpdate && projectActive"
                          size="x-small"
                          color="warning"
                          variant="tonal"
                          :loading="retryingGenerationId === generation.taskRecurrenceGenerationId"
                          :disabled="isMutating"
                          @click="retryGeneration(generation)"
                        >
                          再試行
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
              <div v-if="!isLoadingGenerations && generations.length === 0" class="text-body-2 text-medium-emphasis pa-3">
                生成履歴はありません。
              </div>
            </div>

            <div v-else class="text-body-2 text-medium-emphasis pa-4">
              左の一覧から規則を選択するか、新しい規則を作成してください。
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="isArchiveConfirmOpen" max-width="480" :persistent="isArchiving">
    <v-card>
      <v-card-title>繰り返しTask規則をアーカイブしますか？</v-card-title>
      <v-card-text>
        {{ selectedRule?.title }}<br />
        生成履歴は保持されますが、将来のTask生成は停止します。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isArchiving" @click="isArchiveConfirmOpen = false">キャンセル</v-btn>
        <v-btn color="error" :loading="isArchiving" @click="confirmArchive">アーカイブ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.recurrence-detail {
  white-space: pre-wrap;
}

.generation-table {
  overflow-x: auto;
}
</style>
