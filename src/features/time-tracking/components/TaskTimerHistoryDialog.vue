<script setup lang="ts">
import { TASK_TIMER_HISTORY_CONTROL } from "@/features/time-tracking/composables/useCurrentTaskTimer";
import { useTaskTimerHistory } from "@/features/time-tracking/composables/useTaskTimerHistory";
import {
  formatElapsedSeconds,
  formatJstDateTime,
  getTimerSessionStatusColor,
  getTimerSessionStatusLabel,
} from "@/features/time-tracking/utils/timeTracking";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  closeDialog,
  dateFrom,
  dateTo,
  errorMessages,
  history,
  isLoading,
  isOpen,
  loadHistory,
  loadNextPage,
  loadPreviousPage,
  openDialog,
} = useTaskTimerHistory();
</script>

<template>
  <!-- ヘッダー内に置くため、文字色は親（ヘッダーの白）を引き継ぐ。 -->
  <UButton
    icon="i-mdi-history"
    size="sm"
    variant="ghost"
    square
    class="text-inherit hover:bg-current/4"
    aria-label="Timer履歴を開く"
    title="Timer履歴"
    :data-task-timer-control="TASK_TIMER_HISTORY_CONTROL"
    @click="openDialog"
  />

  <UModal v-model:open="isOpen" :dismissible="!isLoading" :ui="{ content: 'max-w-240' }">
    <template #title>
      <span class="flex items-center">
        <UIcon name="i-mdi-history" class="me-2 size-6" />
        Timer履歴
      </span>
    </template>
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>

      <div class="-m-3 mb-0 flex flex-wrap items-end">
        <div class="w-full p-3 sm:w-5/12">
          <UFormField label="開始日" class="pb-0">
            <UInput v-model="dateFrom" type="date" :disabled="isLoading" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-5/12">
          <UFormField label="終了日" class="pb-0">
            <UInput v-model="dateTo" type="date" :disabled="isLoading" class="w-full" />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/6">
          <UButton block color="primary" :loading="isLoading" @click="loadHistory(0)">検索</UButton>
        </div>
      </div>

      <div v-if="isLoading" class="flex flex-col gap-3 py-2">
        <USkeleton v-for="row in 5" :key="row" class="h-8 w-full" />
      </div>
      <div v-else-if="history?.sessions.length" class="overflow-x-auto">
        <table class="app-table app-table-hover min-w-205 [&_td]:h-13">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">状態</th>
              <th scope="col">開始</th>
              <th scope="col">終了</th>
              <th scope="col">時間</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="session in history.sessions" :key="session.timerSessionId">
              <td>
                <div>{{ session.taskTitle }}</div>
                <div class="text-xs text-muted">
                  {{ session.projectKey }} / Task {{ session.taskId }}
                </div>
              </td>
              <td>
                <UBadge :color="getTimerSessionStatusColor(session.statusCode)" size="sm">
                  {{ getTimerSessionStatusLabel(session.statusCode) }}
                </UBadge>
              </td>
              <td class="whitespace-nowrap">{{ formatJstDateTime(session.startedAt) }}</td>
              <td class="whitespace-nowrap">
                {{ session.stoppedAt ? formatJstDateTime(session.stoppedAt) : "—" }}
              </td>
              <td class="whitespace-nowrap">
                {{
                  session.durationSeconds === null
                    ? "—"
                    : formatElapsedSeconds(session.durationSeconds)
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatusAlert v-else-if="history" type="info" variant="soft"
        >指定期間のTimer履歴はありません。</StatusAlert
      >

      <div v-if="history" class="mt-4 flex items-center justify-center gap-3">
        <UButton
          icon="i-mdi-chevron-left"
          size="sm"
          variant="ghost"
          square
          :disabled="isLoading || history.page === 0"
          aria-label="前のTimer履歴ページ"
          @click="loadPreviousPage"
        />
        <span class="text-sm">
          {{ history.totalPages === 0 ? 0 : history.page + 1 }} / {{ history.totalPages }} （{{
            history.totalElements
          }}件）
        </span>
        <UButton
          icon="i-mdi-chevron-right"
          size="sm"
          variant="ghost"
          square
          :disabled="isLoading || history.page + 1 >= history.totalPages"
          aria-label="次のTimer履歴ページ"
          @click="loadNextPage"
        />
      </div>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isLoading" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
