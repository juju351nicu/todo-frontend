<script setup lang="ts">
import { useTaskWorkLogAudits } from "@/features/time-tracking/composables/useTaskWorkLogAudits";
import {
  formatJstDateTime,
  formatNullableEffortMinutes,
  getWorkLogAuditActionColor,
  getWorkLogAuditActionLabel,
} from "@/features/time-tracking/utils/timeTracking";
import StatusAlert from "@/shared/components/StatusAlert.vue";

interface Props {
  /** 監査対象TaskのProject ID。 */
  projectId: number;
  /** Board・WBSと共通の監査対象Task ID。 */
  taskId: number;
}

const props = defineProps<Props>();
const { audits, closeDialog, errorMessages, isLoading, isOpen, loadNextPage, loadPreviousPage, openDialog } =
  useTaskWorkLogAudits(props.projectId, props.taskId);
</script>

<template>
  <UButton icon="i-mdi-history" variant="soft" size="sm" @click="openDialog">工数の変更履歴</UButton>

  <UModal
    v-model:open="isOpen"
    :dismissible="!isLoading"
    title="Task実績工数の変更履歴"
    :ui="{ content: 'max-w-240' }"
  >
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <div v-if="isLoading" class="flex flex-col gap-3 py-2">
        <USkeleton v-for="row in 5" :key="row" class="h-8 w-full" />
      </div>
      <div v-else-if="audits?.audits.length" class="overflow-x-auto">
        <table class="app-table app-table-hover min-w-205 [&_td]:h-13">
          <thead>
            <tr>
              <th scope="col">操作日時</th>
              <th scope="col">業務日</th>
              <th scope="col">操作</th>
              <th scope="col">工数変更</th>
              <th scope="col">作業者／操作者</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="audit in audits.audits" :key="audit.workLogAuditId">
              <td class="whitespace-nowrap">{{ formatJstDateTime(audit.occurredAt) }}</td>
              <td class="whitespace-nowrap">{{ audit.workDate }}</td>
              <td>
                <UBadge :color="getWorkLogAuditActionColor(audit.actionCode)" size="sm">
                  {{ getWorkLogAuditActionLabel(audit.actionCode) }}
                </UBadge>
                <div v-if="audit.timerSessionId !== null" class="mt-1 text-xs">Timer {{ audit.timerSessionId }}</div>
              </td>
              <td class="whitespace-nowrap">
                {{ formatNullableEffortMinutes(audit.beforeMinutes) }} →
                {{ formatNullableEffortMinutes(audit.afterMinutes) }}
              </td>
              <td>
                作業者 {{ audit.workerAccountId }}
                <div class="text-xs text-muted">操作者 {{ audit.actorAccountId }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StatusAlert v-else-if="audits" type="info" variant="soft">このTaskの工数変更履歴はまだありません。</StatusAlert>

      <div v-if="audits" class="mt-4 flex items-center justify-center gap-3">
        <UButton
          icon="i-mdi-chevron-left"
          size="sm"
          variant="ghost"
          square
          :disabled="isLoading || audits.page === 0"
          aria-label="前の工数変更履歴ページ"
          @click="loadPreviousPage"
        />
        <span class="text-sm">
          {{ audits.totalPages === 0 ? 0 : audits.page + 1 }} / {{ audits.totalPages }}
          （{{ audits.totalElements }}件）
        </span>
        <UButton
          icon="i-mdi-chevron-right"
          size="sm"
          variant="ghost"
          square
          :disabled="isLoading || audits.page + 1 >= audits.totalPages"
          aria-label="次の工数変更履歴ページ"
          @click="loadNextPage"
        />
      </div>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isLoading" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>
</template>
