<script setup lang="ts">
import { useTaskWorkLogAudits } from "@/features/time-tracking/composables/useTaskWorkLogAudits";
import {
  formatEffortMinutes,
  formatJstDateTime,
  getWorkLogAuditActionLabel,
} from "@/features/time-tracking/utils/timeTracking";

interface Props {
  /** 監査対象TaskのProject ID。 */
  projectId: number;
  /** Board・WBSと共通の監査対象Task ID。 */
  taskId: number;
}

const props = defineProps<Props>();
const {
  audits,
  closeDialog,
  errorMessages,
  isLoading,
  isOpen,
  loadNextPage,
  loadPreviousPage,
  openDialog,
} = useTaskWorkLogAudits(props.projectId, props.taskId);

/** nullableな変更前後分数を監査表向け表示へ変換する。 */
const formatAuditMinutes = (minutes: number | null): string =>
  minutes === null ? "—" : formatEffortMinutes(minutes);
</script>

<template>
  <v-btn
    prepend-icon="mdi-history"
    variant="tonal"
    size="small"
    @click="openDialog"
  >
    工数の変更履歴
  </v-btn>

  <v-dialog v-model="isOpen" max-width="960" :persistent="isLoading">
    <v-card>
      <v-card-title>Task実績工数の変更履歴</v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>
        <v-skeleton-loader v-if="isLoading" type="table" />
        <div v-else-if="audits?.audits.length" class="audit-table-scroll">
          <v-table hover class="audit-table">
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
                <td class="text-no-wrap">{{ formatJstDateTime(audit.occurredAt) }}</td>
                <td class="text-no-wrap">{{ audit.workDate }}</td>
                <td>
                  <v-chip
                    :color="audit.actionCode === 'TIMER_APPLY' ? 'primary' : 'default'"
                    size="small"
                  >
                    {{ getWorkLogAuditActionLabel(audit.actionCode) }}
                  </v-chip>
                  <div v-if="audit.timerSessionId !== null" class="text-caption mt-1">
                    Timer {{ audit.timerSessionId }}
                  </div>
                </td>
                <td class="text-no-wrap">
                  {{ formatAuditMinutes(audit.beforeMinutes) }} →
                  {{ formatAuditMinutes(audit.afterMinutes) }}
                </td>
                <td>
                  作業者 {{ audit.workerAccountId }}
                  <div class="text-caption text-medium-emphasis">
                    操作者 {{ audit.actorAccountId }}
                  </div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-else-if="audits" type="info" variant="tonal">
          このTaskの工数変更履歴はまだありません。
        </v-alert>

        <div v-if="audits" class="d-flex align-center justify-center ga-3 mt-4">
          <v-btn
            icon="mdi-chevron-left"
            size="small"
            variant="text"
            :disabled="isLoading || audits.page === 0"
            aria-label="前の工数変更履歴ページ"
            @click="loadPreviousPage"
          />
          <span class="text-body-2">
            {{ audits.totalPages === 0 ? 0 : audits.page + 1 }} / {{ audits.totalPages }}
            （{{ audits.totalElements }}件）
          </span>
          <v-btn
            icon="mdi-chevron-right"
            size="small"
            variant="text"
            :disabled="isLoading || audits.page + 1 >= audits.totalPages"
            aria-label="次の工数変更履歴ページ"
            @click="loadNextPage"
          />
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isLoading" @click="closeDialog">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.audit-table-scroll {
  overflow-x: auto;
}

.audit-table {
  min-width: 820px;
}
</style>
