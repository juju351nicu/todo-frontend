<script setup lang="ts">
import { onBeforeMount } from "vue";

import TodoPriorityBadge from "@/features/task/components/TodoPriorityBadge.vue";
import {
  TASK_SEARCH_CONTROL,
  TASK_SEARCH_KEYWORD_MAX_LENGTH,
  useTaskSearchPage,
} from "@/features/task/composables/useTaskSearchPage";
import { formatMyTaskRemainingDays } from "@/features/task/utils/taskDisplay";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  activeSavedView,
  applySavedView,
  cancelDeleteSavedView,
  changeProject,
  columnOptions,
  createSavedView,
  deleteSavedView,
  errorMessages,
  executeSearch,
  filters,
  initialize,
  isBusy,
  isColumnVisible,
  isDeleteConfirmationOpen,
  options,
  priorityOptions,
  resetSearch,
  requestDeleteSavedView,
  savedViewName,
  savedViews,
  selectedSavedViewId,
  showTask,
  successMessage,
  tasks,
  truncated,
  updateSavedView,
  visibleColumns,
} = useTaskSearchPage();

onBeforeMount(initialize);
</script>

<template>
  <div class="max-w-400 p-4">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs leading-8 font-medium tracking-[.1666666667em] text-muted uppercase">Work Management</div>
        <h1 class="text-[2.125rem] leading-10 font-bold tracking-[.0073529412em]">Task検索</h1>
        <p class="mt-1 mb-0 text-sm text-muted">参照できるProjectのTaskを横断して検索し、よく使う条件を保存できます。</p>
      </div>
      <UButton icon="i-mdi-refresh" variant="ghost" :loading="isBusy" @click="initialize">再読み込み</UButton>
    </div>

    <LoadingIndicator v-if="isBusy" />
    <StatusAlert v-if="errorMessages.length" type="error" class="mb-4" closable @close="errorMessages = []">
      <div v-for="message in errorMessages" :key="message">{{ message }}</div>
    </StatusAlert>
    <StatusAlert v-if="successMessage" type="success" variant="soft" class="mb-4">{{ successMessage }}</StatusAlert>

    <UCard variant="outline" class="mb-4">
      <template #header>
        <div class="flex items-center">
          <UIcon name="i-mdi-bookmark-outline" class="me-2 size-6" />
          Saved View
        </div>
      </template>
      <div class="-m-3 flex flex-wrap items-center">
        <div class="w-full p-3 md:w-1/3">
          <UFormField label="保存した条件" class="pb-0">
            <USelectMenu
              :model-value="selectedSavedViewId ?? undefined"
              :items="savedViews"
              label-key="name"
              value-key="savedViewId"
              :search-input="false"
              clear
              class="w-full"
              :data-task-search-control="TASK_SEARCH_CONTROL.savedViewSelect"
              @update:model-value="applySavedView($event ?? null)"
              @clear="applySavedView(null)"
            />
          </UFormField>
        </div>
        <div class="relative w-full p-3 md:w-1/3">
          <UFormField label="Saved View名">
            <UInput
              v-model="savedViewName"
              :maxlength="100"
              class="w-full"
              :data-task-search-control="TASK_SEARCH_CONTROL.savedViewName"
            />
          </UFormField>
          <FieldCounter :value="savedViewName" :max="100" class="end-7 bottom-3.5" />
        </div>
        <div class="flex w-full flex-wrap gap-2 p-3 md:w-1/3">
          <UButton color="primary" icon="i-mdi-content-save-plus-outline" @click="createSavedView">新規保存</UButton>
          <UButton
            variant="outline"
            icon="i-mdi-content-save-edit-outline"
            :disabled="!activeSavedView"
            @click="updateSavedView"
          >
            更新
          </UButton>
          <UButton
            color="error"
            variant="ghost"
            icon="i-mdi-delete-outline"
            :disabled="!activeSavedView"
            @click="requestDeleteSavedView"
          >
            削除
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard variant="outline" class="mb-4">
      <template #header>
        <div class="flex items-center">
          <UIcon name="i-mdi-filter-outline" class="me-2 size-6" />
          検索条件
        </div>
      </template>
      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 md:w-1/2">
          <UFormField label="キーワード">
            <UInput
              v-model="filters.keyword"
              placeholder="Task名・説明・Project名／キー"
              icon="i-mdi-magnify"
              :maxlength="TASK_SEARCH_KEYWORD_MAX_LENGTH"
              class="w-full"
              @keydown.enter="executeSearch"
            >
              <template v-if="filters.keyword" #trailing>
                <UButton
                  icon="i-mdi-close-circle"
                  variant="ghost"
                  size="xs"
                  square
                  class="text-muted"
                  aria-label="キーワードをクリア"
                  @click="filters.keyword = ''"
                />
              </template>
            </UInput>
          </UFormField>
        </div>
        <div class="w-full p-3 md:w-1/4">
          <UFormField label="Project">
            <USelectMenu
              :model-value="filters.projectId ?? undefined"
              :items="options.projects"
              label-key="projectName"
              value-key="projectId"
              description-key="projectKey"
              :search-input="false"
              clear
              class="w-full"
              @update:model-value="changeProject($event ?? null)"
              @clear="changeProject(null)"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 md:w-1/4">
          <UFormField label="担当者">
            <USelectMenu
              :model-value="filters.assigneeAccountId ?? undefined"
              :items="options.assignees"
              label-key="displayName"
              value-key="accountId"
              :search-input="false"
              clear
              class="w-full"
              @update:model-value="filters.assigneeAccountId = $event ?? null"
              @clear="filters.assigneeAccountId = null"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <UFormField label="状態">
            <USelectMenu
              :model-value="filters.statusCode ?? undefined"
              :items="options.statuses"
              label-key="statusName"
              value-key="statusCode"
              :search-input="false"
              clear
              class="w-full"
              @update:model-value="filters.statusCode = $event ?? null"
              @clear="filters.statusCode = null"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <UFormField label="優先度">
            <USelectMenu
              :model-value="filters.priority ?? undefined"
              :items="[...priorityOptions]"
              label-key="title"
              value-key="value"
              :search-input="false"
              clear
              class="w-full"
              @update:model-value="filters.priority = $event ?? null"
              @clear="filters.priority = null"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <UFormField label="期限From">
            <UInput
              :model-value="filters.dueFrom ?? ''"
              type="date"
              class="w-full"
              @update:model-value="filters.dueFrom = String($event) || null"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 sm:w-1/2 md:w-1/4">
          <UFormField label="期限To">
            <UInput
              :model-value="filters.dueTo ?? ''"
              type="date"
              class="w-full"
              @update:model-value="filters.dueTo = String($event) || null"
            />
          </UFormField>
        </div>
        <div class="w-full p-3 md:w-1/2">
          <UFormField label="表示列（Task名は常に表示）" class="pb-0">
            <USelectMenu
              v-model="visibleColumns"
              :items="columnOptions"
              label-key="label"
              value-key="code"
              multiple
              :search-input="false"
              class="w-full"
            >
              <template #default>
                <span class="flex flex-wrap gap-1">
                  <UBadge v-for="column in columnOptions.filter((option) => visibleColumns.includes(option.code))" :key="column.code" size="sm">
                    {{ column.label }}
                  </UBadge>
                </span>
              </template>
            </USelectMenu>
          </UFormField>
        </div>
        <div class="flex w-full flex-wrap items-center justify-end gap-2 p-3 md:w-1/2">
          <UButton variant="ghost" icon="i-mdi-filter-remove-outline" @click="resetSearch">リセット</UButton>
          <UButton color="primary" icon="i-mdi-magnify" @click="executeSearch">検索</UButton>
        </div>
      </div>
    </UCard>

    <StatusAlert v-if="truncated" type="info" variant="soft" class="mb-4">
      検索結果が100件を超えたため、先頭100件を表示しています。条件を追加してください。
    </StatusAlert>
    <!-- 検索に失敗したときは結果を消しているだけなので、「一致するTaskはありません」とは出さない（動作確認/15_Task検索 G-2）。 -->
    <StatusAlert v-if="!isBusy && tasks.length === 0 && !errorMessages.length" type="info" variant="soft" class="mb-4">
      条件に一致するTaskはありません。
    </StatusAlert>

    <UCard v-if="tasks.length" variant="outline" class="overflow-hidden" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="max-h-[min(62vh,680px)] overflow-auto">
        <table class="app-table app-table-hover [&_td]:h-13 [&_td]:py-2 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-1 [&_thead_th]:bg-default">
          <thead>
            <tr>
              <th>Task</th>
              <th v-if="isColumnVisible('PROJECT')">Project</th>
              <th v-if="isColumnVisible('STATUS')">状態</th>
              <th v-if="isColumnVisible('ASSIGNEE')">担当者</th>
              <th v-if="isColumnVisible('PRIORITY')">優先度</th>
              <th v-if="isColumnVisible('START_DATE')">開始日</th>
              <th v-if="isColumnVisible('DUE_DATE')">期限</th>
              <th v-if="isColumnVisible('PROGRESS')">進捗</th>
              <th v-if="isColumnVisible('DETAIL')">説明</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in tasks"
              :key="task.taskId"
              class="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
              tabindex="0"
              @click="showTask(task)"
              @keydown.enter="showTask(task)"
            >
              <td class="min-w-60 font-medium">{{ task.title }}</td>
              <td v-if="isColumnVisible('PROJECT')">
                <div>{{ task.projectName }}</div>
                <div class="text-xs text-muted">{{ task.projectKey }}</div>
              </td>
              <td v-if="isColumnVisible('STATUS')">{{ task.statusName }}</td>
              <td v-if="isColumnVisible('ASSIGNEE')">{{ task.assigneeDisplayName }}</td>
              <td v-if="isColumnVisible('PRIORITY')">
                <TodoPriorityBadge :priority="task.priority" />
              </td>
              <td v-if="isColumnVisible('START_DATE')">{{ task.dateFrom }}</td>
              <td v-if="isColumnVisible('DUE_DATE')">
                <div>{{ task.dueDate }}</div>
                <div class="text-xs" :class="task.remainingDays < 0 ? 'text-error' : 'text-muted'">
                  {{ formatMyTaskRemainingDays(task.remainingDays) }}
                </div>
              </td>
              <td v-if="isColumnVisible('PROGRESS')" class="min-w-30">
                <div class="mb-1 text-xs">{{ Number(task.progressPercent) }}%</div>
                <UProgress :model-value="Number(task.progressPercent)" size="xs" />
              </td>
              <td v-if="isColumnVisible('DETAIL')" class="max-w-120 min-w-70 whitespace-normal">{{ task.detail || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <UModal v-model:open="isDeleteConfirmationOpen" :dismissible="false" title="Saved Viewを削除" :ui="{ content: 'max-w-120' }">
      <template #body>「{{ activeSavedView?.name }}」を削除します。この操作は取り消せません。</template>
      <template #footer>
        <UButton variant="ghost" @click="cancelDeleteSavedView">キャンセル</UButton>
        <UButton color="error" variant="ghost" @click="deleteSavedView">削除</UButton>
      </template>
    </UModal>
  </div>
</template>
