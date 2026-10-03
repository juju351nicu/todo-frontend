<script setup lang="ts">
import { useTaskTimerHistory } from "@/features/time-tracking/composables/useTaskTimerHistory";
import {
  formatElapsedSeconds,
  formatJstDateTime,
  getTimerSessionStatusLabel,
} from "@/features/time-tracking/utils/timeTracking";

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

/** Session状態ごとのChip色を返す。 */
const getStatusColor = (status: "RUNNING" | "STOPPED" | "CANCELED"): string =>
  ({ RUNNING: "success", STOPPED: "primary", CANCELED: "default" })[status];
</script>

<template>
  <v-btn
    icon="mdi-history"
    size="small"
    variant="text"
    aria-label="Timer履歴を開く"
    title="Timer履歴"
    @click="openDialog"
  />

  <v-dialog v-model="isOpen" max-width="960" :persistent="isLoading">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-history" class="mr-2" />
        Timer履歴
      </v-card-title>
      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>

        <v-row align="center" class="mb-2">
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="dateFrom"
              label="開始日"
              type="date"
              hide-details
              :disabled="isLoading"
            />
          </v-col>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="dateTo"
              label="終了日"
              type="date"
              hide-details
              :disabled="isLoading"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-btn
              block
              color="primary"
              :loading="isLoading"
              @click="loadHistory(0)"
            >
              検索
            </v-btn>
          </v-col>
        </v-row>

        <v-skeleton-loader v-if="isLoading" type="table" />
        <div v-else-if="history?.sessions.length" class="history-table-scroll">
          <v-table hover class="history-table">
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
                  <div class="text-caption text-medium-emphasis">
                    {{ session.projectKey }} / Task {{ session.taskId }}
                  </div>
                </td>
                <td>
                  <v-chip :color="getStatusColor(session.statusCode)" size="small">
                    {{ getTimerSessionStatusLabel(session.statusCode) }}
                  </v-chip>
                </td>
                <td class="text-no-wrap">{{ formatJstDateTime(session.startedAt) }}</td>
                <td class="text-no-wrap">
                  {{ session.stoppedAt ? formatJstDateTime(session.stoppedAt) : "—" }}
                </td>
                <td class="text-no-wrap">
                  {{
                    session.durationSeconds === null
                      ? "—"
                      : formatElapsedSeconds(session.durationSeconds)
                  }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
        <v-alert v-else-if="history" type="info" variant="tonal">
          指定期間のTimer履歴はありません。
        </v-alert>

        <div v-if="history" class="d-flex align-center justify-center ga-3 mt-4">
          <v-btn
            icon="mdi-chevron-left"
            size="small"
            variant="text"
            :disabled="isLoading || history.page === 0"
            aria-label="前のTimer履歴ページ"
            @click="loadPreviousPage"
          />
          <span class="text-body-2">
            {{ history.totalPages === 0 ? 0 : history.page + 1 }} / {{ history.totalPages }}
            （{{ history.totalElements }}件）
          </span>
          <v-btn
            icon="mdi-chevron-right"
            size="small"
            variant="text"
            :disabled="isLoading || history.page + 1 >= history.totalPages"
            aria-label="次のTimer履歴ページ"
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
.history-table-scroll {
  overflow-x: auto;
}

.history-table {
  min-width: 820px;
}
</style>
