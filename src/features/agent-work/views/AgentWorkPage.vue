<script setup lang="ts">
import { useAgentWorkPage } from "@/features/agent-work/composables/useAgentWorkPage";
import {
  getAgentWorkRecordKindLabel,
  getAgentWorkStatusColor,
  getAgentWorkStatusLabel,
} from "@/features/agent-work/utils/agentWork";
import {
  formatElapsedSeconds,
  formatJstDateTime,
} from "@/features/time-tracking/utils/timeTracking";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canRead,
  statusFilter,
  page,
  records,
  selectedSession,
  offset,
  recordOffset,
  isLoading,
  isRecordsLoading,
  errorMessages,
  recordErrorMessages,
  isRecordsOpen,
  canPrevious,
  canNext,
  canPreviousRecords,
  canNextRecords,
  loadRecords,
  reload,
  nextPage,
  previousPage,
  nextRecords,
  previousRecords,
} = useAgentWorkPage();
const statuses = [
  { value: "RUNNING", label: "実行中・応答待ち" },
  { value: "FINISHED", label: "終了" },
  { value: "INTERRUPTED", label: "中断" },
  { value: "ALL", label: "すべて" },
];
</script>

<template>
  <main class="page-container py-6">
    <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">AI作業</h1>
        <p class="mt-2 text-muted">並行して進めている作業と、成果・検証結果を確認できます。</p>
      </div>
      <UButton
        icon="i-mdi-refresh"
        color="neutral"
        variant="outline"
        :loading="isLoading"
        :disabled="!canRead"
        @click="reload()"
        >再読み込み</UButton
      >
    </div>
    <StatusAlert v-if="!canRead" type="warning" class="mb-4"
      >AI作業を参照する権限がありません。</StatusAlert
    >
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4"
      ><div v-for="message in errorMessages" :key="message">{{ message }}</div></StatusAlert
    >
    <StatusAlert type="info" class="mb-4"
      >AI作業区間の経過時間です。人の実績工数には加算されません。応答待ちの作業は、長い処理中の場合もあります。</StatusAlert
    >
    <UFormField label="状態" class="mb-4 max-w-80"
      ><USelect
        v-model="statusFilter"
        :items="statuses"
        :disabled="isLoading || !canRead"
        class="w-full"
    /></UFormField>
    <p v-if="page" class="mb-3 text-sm text-muted">
      {{ page.totalElements }}件・更新 {{ formatJstDateTime(page.serverTime) }}
    </p>
    <div v-if="page?.sessions.length" class="grid gap-4 lg:grid-cols-2" :aria-busy="isLoading">
      <UCard v-for="session in page.sessions" :key="session.sessionId">
        <template #header
          ><div class="flex items-center justify-between gap-3">
            <h2 class="min-w-0 font-semibold wrap-anywhere">{{ session.threadLabel }}</h2>
            <UBadge :color="getAgentWorkStatusColor(session)" class="shrink-0">{{
              getAgentWorkStatusLabel(session)
            }}</UBadge>
          </div></template
        >
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Task</dt>
          <dd>
            <RouterLink
              :to="`/projects/${session.projectId}/board?taskId=${session.taskId}`"
              class="text-primary underline"
              >#{{ session.taskId }}</RouterLink
            >・Project #{{ session.projectId }}
          </dd>
          <dt class="text-muted">Agent</dt>
          <dd>{{ session.agentName }}</dd>
          <dt class="text-muted">作業場所</dt>
          <dd class="min-w-0 wrap-anywhere">{{ session.workspacePath }}</dd>
          <dt class="text-muted">開始</dt>
          <dd>{{ formatJstDateTime(session.startedAt) }}</dd>
          <dt class="text-muted">最終応答</dt>
          <dd>{{ formatJstDateTime(session.lastHeartbeatAt) }}</dd>
          <dt class="text-muted">経過</dt>
          <dd>{{ formatElapsedSeconds(session.elapsedSeconds) }}</dd>
          <template v-if="session.endedAt"
            ><dt class="text-muted">終了</dt>
            <dd>{{ formatJstDateTime(session.endedAt) }}</dd></template
          >
        </dl>
        <template #footer
          ><UButton
            color="neutral"
            variant="outline"
            :aria-label="`${session.threadLabel}の成果・検証を見る`"
            @click="loadRecords(session)"
            >成果・検証を見る</UButton
          ></template
        >
      </UCard>
    </div>
    <p v-else-if="isLoading" role="status" class="py-8">AI作業を読み込んでいます。</p>
    <StatusAlert v-else-if="page" type="info">この条件のAI作業はありません。</StatusAlert>
    <div class="mt-4 flex items-center justify-end gap-3">
      <UButton color="neutral" variant="outline" :disabled="!canPrevious" @click="previousPage"
        >前へ</UButton
      >
      <span v-if="page?.sessions.length" class="text-sm"
        >{{ offset + 1 }}〜{{ offset + page.sessions.length }}件</span
      >
      <UButton color="neutral" variant="outline" :disabled="!canNext" @click="nextPage"
        >次へ</UButton
      >
    </div>
    <UModal
      v-model:open="isRecordsOpen"
      title="成果・検証結果"
      :description="selectedSession?.threadLabel"
      :ui="{ content: 'max-w-240' }"
    >
      <template #body>
        <StatusAlert v-if="recordErrorMessages.length" type="error" class="mb-4"
          ><div v-for="message in recordErrorMessages" :key="message">
            {{ message }}
          </div></StatusAlert
        >
        <p v-if="isRecordsLoading" role="status" class="py-4">成果を読み込んでいます。</p>
        <div v-else-if="records?.records.length" class="space-y-4">
          <UCard v-for="record in records.records" :key="record.recordId">
            <template #header
              ><div class="flex flex-wrap justify-between gap-2 text-sm">
                <UBadge color="neutral">{{ getAgentWorkRecordKindLabel(record.kind) }}</UBadge
                ><time :datetime="record.recordedAt">{{
                  formatJstDateTime(record.recordedAt)
                }}</time>
              </div></template
            >
            <p class="whitespace-pre-wrap wrap-anywhere">{{ record.summary }}</p>
            <h3 v-if="record.verification" class="mt-4 font-semibold">検証</h3>
            <p v-if="record.verification" class="whitespace-pre-wrap wrap-anywhere">
              {{ record.verification }}
            </p>
            <h3 v-if="record.artifacts" class="mt-4 font-semibold">根拠・資料</h3>
            <p v-if="record.artifacts" class="whitespace-pre-wrap wrap-anywhere">
              {{ record.artifacts }}
            </p>
            <p v-if="record.gitHead" class="mt-4 text-sm text-muted wrap-anywhere">
              Git HEAD: {{ record.gitHead }}
            </p>
          </UCard>
        </div>
        <StatusAlert v-else-if="records" type="info">成果の記録はまだありません。</StatusAlert>
      </template>
      <template #footer
        ><div class="flex w-full items-center justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="!canPreviousRecords"
            @click="previousRecords"
            >前の記録</UButton
          ><span v-if="records?.records.length" class="text-sm"
            >{{ recordOffset + 1 }}〜{{ recordOffset + records.records.length }}件 /
            {{ records.totalElements }}件</span
          ><UButton
            color="neutral"
            variant="outline"
            :disabled="!canNextRecords"
            @click="nextRecords"
            >次の記録</UButton
          >
        </div></template
      >
    </UModal>
  </main>
</template>
