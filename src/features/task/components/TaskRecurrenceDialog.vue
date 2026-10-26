<script setup lang="ts">
import { toRef } from "vue";

import type { ProjectMember, TaskStatus } from "@/features/project/types/project";
import { useTaskRecurrenceDialog } from "@/features/task/composables/useTaskRecurrenceDialog";
import { TASK_PRIORITY_OPTIONS } from "@/features/task/utils/taskFormOptions";
import {
  formatRecurrenceDateTime,
  formatRecurrenceErrorCode,
  formatRecurrenceSchedule,
  getGenerationStatusColor,
  getGenerationStatusLabel,
  getRecurrenceStatusColor,
  getRecurrenceStatusLabel,
  RECURRENCE_FREQUENCY_OPTIONS,
  RECURRENCE_LIFECYCLE_OPTIONS,
  RECURRENCE_WEEKDAY_OPTIONS,
} from "@/features/task/utils/taskRecurrenceDisplay";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = withDefaults(
  defineProps<{
    projectId: number;
    members: ProjectMember[];
    statuses: TaskStatus[];
    canCreate?: boolean;
    canUpdate?: boolean;
    projectActive?: boolean;
  }>(),
  { canCreate: false, canUpdate: false, projectActive: false },
);

const {
  beginEditing,
  canArchiveSelected,
  canEditSelected,
  cancelForm,
  changeCreationMode,
  confirmArchive,
  createRule,
  creationMode,
  errorMessage,
  form,
  generations,
  isArchiveConfirmOpen,
  isArchiving,
  isCreating,
  isEditing,
  isLoading,
  isLoadingGenerations,
  isLoadingTemplates,
  isMutating,
  isOpen,
  isSaving,
  loadGenerations,
  memberOptions,
  open,
  retryGeneration,
  retryingGenerationId,
  rules,
  saveRule,
  selectRule,
  selectedRule,
  selectedRuleAssigneeDisplayName,
  startCreating,
  statusOptions,
  successMessage,
  templates,
  toggleWeekday,
} = useTaskRecurrenceDialog({
  projectId: toRef(props, "projectId"),
  members: () => props.members,
  statuses: () => props.statuses,
  canUpdate: () => props.canUpdate,
  projectActive: () => props.projectActive,
});

const CREATION_MODE_OPTIONS = [
  { value: "DIRECT", label: "直接入力" },
  { value: "TEMPLATE", label: "Task Template" },
] as const;
</script>

<template>
  <UButton icon="i-mdi-calendar-sync-outline" variant="soft" @click="open">繰り返しTask</UButton>

  <UModal v-model:open="isOpen" :dismissible="!isMutating" :ui="{ content: 'max-w-320' }">
    <template #title>
      <span class="flex items-center">
        繰り返しTask
        <UButton
          icon="i-mdi-close"
          variant="ghost"
          square
          class="ms-auto"
          :disabled="isMutating"
          aria-label="繰り返しTaskを閉じる"
          @click="isOpen = false"
        />
      </span>
    </template>
    <template #body>
      <StatusAlert v-if="errorMessage" type="error" density="compact" class="mb-3">{{ errorMessage }}</StatusAlert>
      <StatusAlert v-if="successMessage" type="success" density="compact" closable class="mb-3" @close="successMessage = ''">
        {{ successMessage }}
      </StatusAlert>
      <StatusAlert v-if="!projectActive" type="info" density="compact" class="mb-3">
        アーカイブ済みProjectでは規則と生成履歴を参照できますが、変更はできません。
      </StatusAlert>
      <UProgress v-if="isLoading" size="xs" class="mb-3" />

      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 md:w-1/3">
          <div class="mb-2 flex items-center">
            <div class="text-base font-bold">規則一覧</div>
            <UButton
              v-if="canCreate && projectActive"
              size="sm"
              color="primary"
              icon="i-mdi-plus"
              class="ms-auto"
              :disabled="isMutating"
              @click="startCreating"
            >
              新規作成
            </UButton>
          </div>
          <ul v-if="rules.length" class="rounded-sm border border-default py-2">
            <li v-for="rule in rules" :key="rule.taskRecurrenceRuleId">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-1.5 text-start"
                :class="selectedRule?.taskRecurrenceRuleId === rule.taskRecurrenceRuleId ? 'bg-primary/12 text-primary' : 'hover:bg-elevated'"
                @click="selectRule(rule)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-base">{{ rule.title }}</span>
                  <span class="block text-sm opacity-60">
                    {{ formatRecurrenceSchedule(rule.frequency, rule.intervalCount, rule.weekdays, rule.monthlyDay) }}
                  </span>
                </span>
                <UBadge :color="getRecurrenceStatusColor(rule.status)" size="xs">{{ getRecurrenceStatusLabel(rule.status) }}</UBadge>
              </button>
            </li>
          </ul>
          <div v-else-if="!isLoading" class="p-3 text-sm text-muted">繰り返しTask規則はありません。</div>
        </div>

        <div class="w-full p-3 md:w-2/3">
          <form v-if="isCreating || isEditing" @submit.prevent="isCreating ? createRule() : saveRule()">
            <div class="mb-3 flex items-center">
              <h2 class="text-xl font-medium">{{ isCreating ? "規則を作成" : "規則を編集" }}</h2>
              <UBadge v-if="isEditing && selectedRule" size="sm" class="ms-auto">version {{ selectedRule.version }}</UBadge>
            </div>

            <UFieldGroup v-if="isCreating" class="mb-4" role="group" aria-label="作成元">
              <UButton
                v-for="option in CREATION_MODE_OPTIONS"
                :key="option.value"
                variant="outline"
                :color="creationMode === option.value ? 'primary' : 'neutral'"
                :class="creationMode === option.value ? 'bg-primary/12' : ''"
                :aria-pressed="creationMode === option.value"
                @click="changeCreationMode(option.value)"
              >
                {{ option.label }}
              </UButton>
            </UFieldGroup>

            <template v-if="!isCreating || creationMode === 'DIRECT'">
              <div class="relative">
                <UFormField label="Taskタイトル">
                  <UInput v-model="form.title" :maxlength="45" :disabled="isMutating" class="w-full" />
                </UFormField>
                <FieldCounter :value="form.title" :max="45" />
              </div>
              <div class="relative">
                <UFormField label="Task詳細">
                  <UTextarea v-model="form.detail" :maxlength="1000" :rows="3" :disabled="isMutating" class="w-full" />
                </UFormField>
                <FieldCounter :value="form.detail" :max="1000" />
              </div>
              <div class="-m-3 flex flex-wrap">
                <div class="w-full p-3 sm:w-1/3">
                  <UFormField label="優先度">
                    <USelect
                      v-model="form.priority"
                      :items="[...TASK_PRIORITY_OPTIONS]"
                      label-key="title"
                      value-key="value"
                      :disabled="isMutating"
                      class="w-full"
                    />
                  </UFormField>
                </div>
                <div class="w-full p-3 sm:w-1/3">
                  <UFormField label="予定工数（分）">
                    <UInput v-model.number="form.plannedEffortMinutes" type="number" min="0" :disabled="isMutating" class="w-full" />
                  </UFormField>
                </div>
                <div class="w-full p-3 sm:w-1/3">
                  <UFormField label="期限オフセット（日）">
                    <UInput v-model.number="form.dueOffsetDays" type="number" min="0" max="365" :disabled="isMutating" class="w-full" />
                  </UFormField>
                </div>
                <div class="w-full p-3 sm:w-1/2">
                  <UFormField label="担当者">
                    <USelect
                      :model-value="form.assigneeAccountId ?? undefined"
                      :items="memberOptions"
                      label-key="title"
                      value-key="value"
                      :disabled="isMutating"
                      class="w-full"
                      @update:model-value="form.assigneeAccountId = $event"
                    />
                  </UFormField>
                </div>
                <div class="w-full p-3 sm:w-1/2">
                  <UFormField label="未完了Board列">
                    <USelect
                      :model-value="form.taskStatusId ?? undefined"
                      :items="statusOptions"
                      label-key="title"
                      value-key="value"
                      :disabled="isMutating"
                      class="w-full"
                      @update:model-value="form.taskStatusId = $event"
                    />
                  </UFormField>
                </div>
              </div>
              <UFormField label="チェック項目" help="入力後にEnterで項目を追加します（最大50件）" class="mb-3">
                <UInputTags v-model="form.checklistContents" :max="50" :disabled="isMutating" class="w-full" />
              </UFormField>
            </template>

            <template v-else>
              <UProgress v-if="isLoadingTemplates" size="xs" class="mb-3" />
              <UFormField label="本人所有Task Template">
                <USelectMenu
                  :model-value="form.taskTemplateId ?? undefined"
                  :items="templates"
                  label-key="name"
                  value-key="taskTemplateId"
                  :search-input="false"
                  :disabled="isMutating || isLoadingTemplates"
                  class="w-full"
                  @update:model-value="form.taskTemplateId = $event ?? null"
                >
                  <template #empty>利用できるTask Templateがありません</template>
                </USelectMenu>
              </UFormField>
              <div class="-m-3 flex flex-wrap">
                <div class="w-full p-3 sm:w-1/2">
                  <UFormField label="担当者上書き" help="未指定時はTemplate既定値、さらに未指定なら作成者">
                    <USelectMenu
                      :model-value="form.assigneeAccountId ?? undefined"
                      :items="memberOptions"
                      label-key="title"
                      value-key="value"
                      :search-input="false"
                      clear
                      :disabled="isMutating"
                      class="w-full"
                      @update:model-value="form.assigneeAccountId = $event ?? null"
                      @clear="form.assigneeAccountId = null"
                    />
                  </UFormField>
                </div>
                <div class="w-full p-3 sm:w-1/2">
                  <UFormField label="Board列上書き" help="未指定時はTemplate既定列">
                    <USelectMenu
                      :model-value="form.taskStatusId ?? undefined"
                      :items="statusOptions"
                      label-key="title"
                      value-key="value"
                      :search-input="false"
                      clear
                      :disabled="isMutating"
                      class="w-full"
                      @update:model-value="form.taskStatusId = $event ?? null"
                      @clear="form.taskStatusId = null"
                    />
                  </UFormField>
                </div>
              </div>
            </template>

            <USeparator class="my-4" />
            <div class="mb-3 text-base font-bold">Schedule</div>
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="頻度">
                  <USelect
                    v-model="form.frequency"
                    :items="[...RECURRENCE_FREQUENCY_OPTIONS]"
                    label-key="title"
                    value-key="value"
                    :disabled="isMutating"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="繰り返し間隔">
                  <UInput
                    v-model.number="form.intervalCount"
                    type="number"
                    min="1"
                    :max="form.frequency === 'DAILY' ? 365 : form.frequency === 'WEEKLY' ? 52 : 24"
                    :disabled="isMutating"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div v-if="form.frequency === 'MONTHLY'" class="w-full p-3 sm:w-1/3">
                <UFormField label="毎月の日付" help="存在しない日は月末に丸めます">
                  <UInput
                    :model-value="form.monthlyDay ?? undefined"
                    type="number"
                    min="1"
                    max="31"
                    :disabled="isMutating"
                    class="w-full"
                    @update:model-value="form.monthlyDay = $event ? Number($event) : null"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="最初の発生日" :help="isEditing ? '作成時のanchorは変更できません' : undefined">
                  <UInput v-model="form.firstOccurrenceDate" type="date" :readonly="isEditing" :disabled="isMutating" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="終了日（任意）">
                  <UInput v-model="form.endDate" type="date" :disabled="isMutating" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="生成先行日数" help="発生日の何日前にTaskを作るか">
                  <UInput v-model.number="form.generationLeadDays" type="number" min="0" max="90" :disabled="isMutating" class="w-full" />
                </UFormField>
              </div>
              <div v-if="isEditing" class="w-full p-3 sm:w-1/3">
                <UFormField label="状態">
                  <USelect
                    v-model="form.status"
                    :items="[...RECURRENCE_LIFECYCLE_OPTIONS]"
                    label-key="title"
                    value-key="value"
                    :disabled="isMutating"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
            <div v-if="form.frequency === 'WEEKLY'" class="mb-4">
              <div class="mb-1 text-sm">発生曜日</div>
              <div class="flex flex-wrap gap-2" role="group" aria-label="発生曜日">
                <UButton
                  v-for="weekday in RECURRENCE_WEEKDAY_OPTIONS"
                  :key="weekday.value"
                  size="md"
                  variant="soft"
                  class="rounded-full normal-case tracking-normal"
                  :class="form.weekdays.includes(weekday.value) ? 'text-primary' : ''"
                  :icon="form.weekdays.includes(weekday.value) ? 'i-mdi-check' : undefined"
                  :aria-pressed="form.weekdays.includes(weekday.value)"
                  :disabled="isMutating"
                  @click="toggleWeekday(weekday.value)"
                >
                  {{ weekday.title }}
                </UButton>
              </div>
            </div>
            <div class="mt-4 flex justify-end gap-2">
              <UButton :disabled="isMutating" @click="cancelForm">キャンセル</UButton>
              <UButton type="submit" color="primary" :loading="isSaving">{{ isCreating ? "作成" : "更新" }}</UButton>
            </div>
          </form>

          <div v-else-if="selectedRule">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-medium">{{ selectedRule.title }}</h2>
              <UBadge :color="getRecurrenceStatusColor(selectedRule.status)" size="sm">
                {{ getRecurrenceStatusLabel(selectedRule.status) }}
              </UBadge>
              <UBadge size="sm">version {{ selectedRule.version }}</UBadge>
              <UButton
                v-if="canEditSelected"
                size="sm"
                variant="ghost"
                icon="i-mdi-pencil-outline"
                class="ms-auto"
                :disabled="isMutating"
                @click="beginEditing"
              >
                編集・停止
              </UButton>
              <UButton
                v-if="canArchiveSelected"
                size="sm"
                variant="ghost"
                color="error"
                icon="i-mdi-archive-outline"
                :disabled="isMutating"
                @click="isArchiveConfirmOpen = true"
              >
                アーカイブ
              </UButton>
            </div>
            <StatusAlert v-if="selectedRule.status === 'BLOCKED'" type="error" density="compact" class="mb-3">
              {{ formatRecurrenceErrorCode(selectedRule.blockedReason) }} 入力や参照先を修正して「有効」で更新してください。
            </StatusAlert>
            <p class="mb-3 text-sm whitespace-pre-wrap">{{ selectedRule.detail }}</p>
            <div class="-m-1 mb-2 flex flex-wrap">
              <div class="w-full p-1 sm:w-1/2">
                <strong>Schedule:</strong>
                {{ formatRecurrenceSchedule(selectedRule.frequency, selectedRule.intervalCount, selectedRule.weekdays, selectedRule.monthlyDay) }}
              </div>
              <div class="w-full p-1 sm:w-1/2"><strong>次回発生日:</strong> {{ selectedRule.nextOccurrenceDate ?? "-" }}</div>
              <div class="w-full p-1 sm:w-1/2">
                <strong>期間:</strong> {{ selectedRule.firstOccurrenceDate }} ～ {{ selectedRule.endDate ?? "終了日なし" }}
              </div>
              <div class="w-full p-1 sm:w-1/2"><strong>生成:</strong> 発生日の{{ selectedRule.generationLeadDays }}日前</div>
              <div class="w-full p-1 sm:w-1/2"><strong>担当者:</strong> {{ selectedRuleAssigneeDisplayName }}</div>
              <div class="w-full p-1 sm:w-1/2"><strong>期限:</strong> 発生日 +{{ selectedRule.dueOffsetDays }}日</div>
              <div class="w-full p-1 sm:w-1/2"><strong>予定工数:</strong> {{ selectedRule.plannedEffortMinutes }}分</div>
              <div class="w-full p-1 sm:w-1/2">
                <strong>作成元:</strong>
                {{ selectedRule.sourceTaskTemplateId === null ? "直接入力" : `Task Template #${selectedRule.sourceTaskTemplateId}` }}
              </div>
            </div>
            <ul v-if="selectedRule.checklistItems.length" class="mb-4 rounded-sm border border-default py-2">
              <li v-for="item in selectedRule.checklistItems" :key="item.position" class="flex items-center gap-8 px-4 py-1.5">
                <UIcon name="i-mdi-checkbox-blank-outline" class="size-6 opacity-60" />
                <span class="text-base">{{ item.content }}</span>
              </li>
            </ul>

            <USeparator class="my-4" />
            <div class="mb-2 flex items-center">
              <div class="text-base font-bold">生成履歴（直近100件）</div>
              <UButton
                size="sm"
                variant="ghost"
                icon="i-mdi-refresh"
                class="ms-auto"
                :loading="isLoadingGenerations"
                :disabled="isMutating"
                @click="loadGenerations"
              >
                再読込
              </UButton>
            </div>
            <UProgress v-if="isLoadingGenerations" size="xs" class="mb-2" />
            <div class="overflow-x-auto">
              <table v-if="generations.length" class="app-table">
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
                      <UBadge :color="getGenerationStatusColor(generation.status)" size="xs">
                        {{ getGenerationStatusLabel(generation.status) }}
                      </UBadge>
                    </td>
                    <td>{{ generation.generatedTaskId === null ? "-" : `#${generation.generatedTaskId}` }}</td>
                    <td>{{ generation.attemptCount }}</td>
                    <td>
                      <span v-if="generation.lastErrorCode">{{ formatRecurrenceErrorCode(generation.lastErrorCode) }}</span>
                      <span v-else>{{ formatRecurrenceDateTime(generation.nextRetryAt) }}</span>
                    </td>
                    <td class="text-end">
                      <UButton
                        v-if="generation.status === 'FAILED' && canUpdate && projectActive"
                        size="xs"
                        color="warning"
                        variant="soft"
                        :loading="retryingGenerationId === generation.taskRecurrenceGenerationId"
                        :disabled="isMutating"
                        @click="retryGeneration(generation)"
                      >
                        再試行
                      </UButton>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!isLoadingGenerations && generations.length === 0" class="p-3 text-sm text-muted">生成履歴はありません。</div>
          </div>

          <div v-else class="p-4 text-sm text-muted">左の一覧から規則を選択するか、新しい規則を作成してください。</div>
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="isArchiveConfirmOpen"
    :dismissible="!isArchiving"
    title="繰り返しTask規則をアーカイブしますか？"
    :ui="{ content: 'max-w-120' }"
  >
    <template #body>
      {{ selectedRule?.title }}<br />
      生成履歴は保持されますが、将来のTask生成は停止します。
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isArchiving" @click="isArchiveConfirmOpen = false">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isArchiving" @click="confirmArchive">アーカイブ</UButton>
    </template>
  </UModal>
</template>
