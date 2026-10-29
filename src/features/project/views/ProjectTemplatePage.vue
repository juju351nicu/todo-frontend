<script setup lang="ts">
import { onBeforeMount } from "vue";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import {
  PROJECT_TEMPLATE_CONTROL,
  buildTemplateItemControlKey,
  useProjectTemplatePage,
} from "@/features/project/composables/useProjectTemplatePage";
import {
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH,
  PROJECT_TEMPLATE_NAME_MAX_LENGTH,
} from "@/features/project/constants/projectLimits";
import {
  formatProjectTemplateOffset,
  formatProjectTemplateParent,
  formatProjectTemplateTaskTitle,
  getProjectTemplatePriorityLabel,
  getProjectTemplateTaskTypeLabel,
  resolveProjectTemplateSlotName,
  resolveProjectTemplateStatusName,
} from "@/features/project/utils/projectTemplateDisplay";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  applyForm,
  applyTemplate,
  archiveTemplate,
  beginEditing,
  canApplyTemplate,
  canEditTemplate,
  cancelEditing,
  closeArchiveConfirm,
  editForm,
  errorMessages,
  initialize,
  isApplyFeedback,
  isApplying,
  isArchiveConfirmOpen,
  isArchiving,
  isEditing,
  isLoadingDetail,
  isLoadingList,
  isMutating,
  isSaving,
  openArchiveConfirm,
  saveTemplate,
  selectTemplate,
  selectedTemplate,
  successMessage,
  templates,
} = useProjectTemplatePage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoadingList || isLoadingDetail" />
  <div class="page-surface p-6">
    <UCard class="mx-auto max-w-360">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-folder-multiple-outline" class="size-6" />
          Project Template
          <UButton
            :to="{ name: ROUTE_NAMES.projectList }"
            variant="ghost"
            icon="i-mdi-view-dashboard-outline"
            class="ms-auto"
          >
            Project一覧
          </UButton>
        </div>
        <div class="text-sm font-normal tracking-normal text-muted">
          Project、member role、Board列、WBS構造を再利用する本人専用Templateです。
        </div>
      </template>

      <!-- Templateからの作成の結果は、作成ボタンの上に出す（isApplyFeedback）。 -->
      <StatusAlert v-if="errorMessages.length && !isApplyFeedback" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert
        v-if="successMessage"
        type="success"
        closable
        class="mb-4"
        @close="successMessage = ''"
      >
        {{ successMessage }}
      </StatusAlert>

      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 lg:w-1/4">
          <div class="mb-2 text-base font-bold">本人所有Template</div>
          <ul v-if="templates.length" class="rounded-sm border border-default py-2">
            <li v-for="template in templates" :key="template.projectTemplateId">
              <button
                type="button"
                class="flex w-full items-center gap-8 px-4 py-2 text-start disabled:opacity-38"
                :class="
                  selectedTemplate?.projectTemplateId === template.projectTemplateId
                    ? 'bg-primary/12 text-primary'
                    : 'hover:bg-elevated'
                "
                :disabled="isMutating || isLoadingDetail"
                :data-project-template-control="
                  buildTemplateItemControlKey(template.projectTemplateId)
                "
                @click="selectTemplate(template)"
              >
                <UIcon name="i-mdi-folder-star-outline" class="size-6 shrink-0 opacity-60" />
                <span class="min-w-0">
                  <span class="block text-base">{{ template.name }}</span>
                  <span class="block text-sm opacity-60">基準日 {{ template.baseDate }}</span>
                </span>
              </button>
            </li>
          </ul>
          <div
            v-else-if="!isLoadingList"
            class="rounded-sm border border-default p-5 text-center text-muted"
          >
            保存済みTemplateはありません。OWNERはProject Boardから現在の構造を保存できます。
          </div>
        </div>

        <div class="w-full p-3 lg:w-3/4">
          <UProgress v-if="isLoadingDetail" size="xs" class="mb-4" />

          <template v-if="selectedTemplate">
            <div v-if="!isEditing" class="mb-4 flex flex-wrap items-start gap-2">
              <div>
                <h1 class="text-2xl">{{ selectedTemplate.name }}</h1>
                <div class="text-sm text-muted">基準日 {{ selectedTemplate.baseDate }}</div>
              </div>
              <UButton
                v-if="canEditTemplate"
                variant="ghost"
                icon="i-mdi-pencil-outline"
                class="ms-auto"
                :disabled="isMutating"
                :data-project-template-control="PROJECT_TEMPLATE_CONTROL.editButton"
                @click="beginEditing"
              >
                編集
              </UButton>
              <UButton
                v-if="canEditTemplate"
                color="error"
                variant="ghost"
                icon="i-mdi-archive-outline"
                :disabled="isMutating"
                @click="openArchiveConfirm"
              >
                アーカイブ
              </UButton>
            </div>

            <form v-if="isEditing" class="mb-5" @submit.prevent="saveTemplate">
              <UCard variant="outline">
                <template #header>
                  <div class="text-base font-normal">Template headerを編集</div>
                </template>
                <div class="relative">
                  <UFormField label="Template名">
                    <UInput
                      v-model="editForm.name"
                      :maxlength="PROJECT_TEMPLATE_NAME_MAX_LENGTH"
                      :disabled="isSaving"
                      class="w-full"
                      :data-project-template-control="PROJECT_TEMPLATE_CONTROL.editName"
                    />
                  </UFormField>
                  <FieldCounter :value="editForm.name" :max="PROJECT_TEMPLATE_NAME_MAX_LENGTH" />
                </div>
                <div class="relative">
                  <UFormField label="生成Projectへ複製する説明">
                    <UTextarea
                      v-model="editForm.description"
                      :maxlength="PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH"
                      :rows="4"
                      :disabled="isSaving"
                      class="w-full"
                    />
                  </UFormField>
                  <FieldCounter
                    :value="editForm.description"
                    :max="PROJECT_TEMPLATE_DESCRIPTION_MAX_LENGTH"
                  />
                </div>
                <StatusAlert type="info" variant="soft" density="compact">
                  member slot、Board列、Task、checklist、依存関係のsnapshotは編集されません。
                </StatusAlert>
                <template #footer>
                  <UButton
                    variant="ghost"
                    class="ms-auto"
                    :disabled="isSaving"
                    @click="cancelEditing"
                    >キャンセル</UButton
                  >
                  <UButton type="submit" color="primary" variant="ghost" :loading="isSaving"
                    >保存</UButton
                  >
                </template>
              </UCard>
            </form>

            <p v-if="!isEditing" class="mb-5 whitespace-pre-wrap">
              {{ selectedTemplate.description || "説明はありません。" }}
            </p>

            <UCard variant="outline" class="mb-5">
              <template #header>
                <div class="flex flex-wrap items-center gap-2 text-base font-normal">
                  <UIcon name="i-mdi-playlist-plus" class="size-6" />
                  TemplateからProjectを作成
                  <UBadge size="sm" class="ms-auto"
                    >{{ selectedTemplate.memberSlots.length }} member slot</UBadge
                  >
                </div>
              </template>
              <StatusAlert
                v-if="!canApplyTemplate"
                type="info"
                variant="soft"
                density="compact"
                class="mb-4"
              >
                Project作成にはPROJECT_CREATE permissionが必要です。
              </StatusAlert>
              <div class="-m-3 flex flex-wrap">
                <div class="relative w-full p-3 md:w-1/3">
                  <UFormField label="Projectキー" help="大文字英数字をハイフンで区切ります。">
                    <UInput
                      v-model="applyForm.projectKey"
                      :maxlength="PROJECT_KEY_MAX_LENGTH"
                      :disabled="!canApplyTemplate || isMutating"
                      class="w-full"
                    />
                  </UFormField>
                  <FieldCounter
                    :value="applyForm.projectKey"
                    :max="PROJECT_KEY_MAX_LENGTH"
                    class="end-7 bottom-3.5"
                  />
                </div>
                <div class="relative w-full p-3 md:w-1/3">
                  <UFormField label="Project名">
                    <UInput
                      v-model="applyForm.name"
                      :maxlength="PROJECT_NAME_MAX_LENGTH"
                      :disabled="!canApplyTemplate || isMutating"
                      class="w-full"
                    />
                  </UFormField>
                  <FieldCounter
                    :value="applyForm.name"
                    :max="PROJECT_NAME_MAX_LENGTH"
                    class="end-7 bottom-3.5"
                  />
                </div>
                <div class="w-full p-3 md:w-1/3">
                  <UFormField label="Project開始日">
                    <UInput
                      v-model="applyForm.projectStartDate"
                      type="date"
                      :disabled="!canApplyTemplate || isMutating"
                      class="w-full"
                    />
                  </UFormField>
                </div>
              </div>

              <div class="mt-2 mb-2 text-sm font-medium">member slot mapping</div>
              <div class="-m-3 flex flex-wrap">
                <div
                  v-for="slot in selectedTemplate.memberSlots"
                  :key="slot.slotKey"
                  class="w-full p-3 md:w-1/2"
                >
                  <UFormField
                    :label="`${slot.displayName}（${slot.projectRole}）`"
                    :help="
                      slot.slotKey === 'OWNER_1'
                        ? '未指定時は自分を割り当てます。'
                        : '割り当てるアカウントIDを入力します。'
                    "
                  >
                    <UInput
                      :model-value="applyForm.memberMappings[slot.slotKey] ?? undefined"
                      type="number"
                      min="1"
                      :disabled="!canApplyTemplate || isMutating"
                      class="w-full"
                      @update:model-value="applyForm.memberMappings[slot.slotKey] = $event"
                    />
                  </UFormField>
                </div>
              </div>
              <StatusAlert type="info" variant="soft" density="compact" class="mb-4">
                各slotへ異なるACTIVEアカウントIDを割り当ててください。自分はOWNERとして参加する必要があります。
              </StatusAlert>
              <StatusAlert v-if="errorMessages.length && isApplyFeedback" type="error" class="mb-4">
                <div v-for="message in errorMessages" :key="message">{{ message }}</div>
              </StatusAlert>
              <div class="flex justify-end">
                <UButton
                  color="primary"
                  icon="i-mdi-folder-plus-outline"
                  :loading="isApplying"
                  :disabled="!canApplyTemplate || isMutating"
                  :data-project-template-control="PROJECT_TEMPLATE_CONTROL.applyButton"
                  @click="applyTemplate"
                >
                  Projectを作成してBoardを開く
                </UButton>
              </div>
            </UCard>

            <div class="-m-3 mb-2 flex flex-wrap">
              <div class="w-full p-3 md:w-1/2">
                <UCard variant="outline" class="h-full" :ui="{ body: 'px-0 sm:px-0' }">
                  <template #header>
                    <div class="text-base font-normal">
                      member slot（{{ selectedTemplate.memberSlots.length }}）
                    </div>
                  </template>
                  <ul class="py-2">
                    <li
                      v-for="slot in selectedTemplate.memberSlots"
                      :key="slot.slotKey"
                      class="px-4 py-1.5"
                    >
                      <div class="text-base">{{ slot.displayName }}</div>
                      <div class="text-sm text-muted">{{ slot.projectRole }}</div>
                    </li>
                  </ul>
                </UCard>
              </div>
              <div class="w-full p-3 md:w-1/2">
                <UCard variant="outline" class="h-full" :ui="{ body: 'px-0 sm:px-0' }">
                  <template #header>
                    <div class="text-base font-normal">
                      Board列（{{ selectedTemplate.statuses.length }}）
                    </div>
                  </template>
                  <ul class="py-2">
                    <li
                      v-for="status in selectedTemplate.statuses"
                      :key="status.statusCode"
                      class="flex items-center px-4 py-1.5"
                    >
                      <span class="flex-1 text-base">{{ status.name }}</span>
                      <UBadge v-if="status.completed" size="xs" color="success">完了列</UBadge>
                    </li>
                  </ul>
                </UCard>
              </div>
            </div>

            <UCard variant="outline" class="mb-5" :ui="{ body: 'px-0 sm:px-0' }">
              <template #header>
                <div class="text-base font-normal">
                  WBS Task snapshot（{{ selectedTemplate.tasks.length }}）
                </div>
              </template>
              <div class="overflow-x-auto">
                <table class="app-table [&_td]:py-2">
                  <thead>
                    <tr>
                      <th>WBS／Task</th>
                      <th>種別</th>
                      <th>Board列</th>
                      <th>担当slot</th>
                      <th>期間offset</th>
                      <th>予定／優先度</th>
                      <th>checklist</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="task in selectedTemplate.tasks" :key="task.projectTemplateTaskId">
                      <td>
                        <div class="font-medium">{{ task.wbsCode || "-" }} {{ task.title }}</div>
                        <div v-if="task.detail" class="max-w-md text-xs whitespace-pre-wrap">
                          {{ task.detail }}
                        </div>
                        <div
                          v-if="task.parentProjectTemplateTaskId !== null"
                          class="text-xs text-muted"
                        >
                          {{
                            formatProjectTemplateParent(
                              task.parentProjectTemplateTaskId,
                              selectedTemplate.tasks
                            )
                          }}
                        </div>
                      </td>
                      <td>{{ getProjectTemplateTaskTypeLabel(task.taskType) }}</td>
                      <td>
                        {{
                          resolveProjectTemplateStatusName(
                            task.statusCode,
                            selectedTemplate.statuses
                          )
                        }}
                      </td>
                      <td>
                        {{
                          resolveProjectTemplateSlotName(
                            task.assigneeSlotKey,
                            selectedTemplate.memberSlots
                          )
                        }}
                      </td>
                      <td>
                        {{ formatProjectTemplateOffset(task.startOffsetDays) }} ～
                        {{ formatProjectTemplateOffset(task.dueOffsetDays) }}
                      </td>
                      <td>
                        {{ task.plannedEffortMinutes }}分・{{
                          getProjectTemplatePriorityLabel(task.priority)
                        }}
                      </td>
                      <td>
                        <ul v-if="task.checklistItems.length" class="min-w-48 list-disc ps-5">
                          <li
                            v-for="item in task.checklistItems"
                            :key="`${item.position}-${item.content}`"
                          >
                            {{ item.content }}
                          </li>
                        </ul>
                        <span v-else>0件</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </UCard>

            <UCard variant="outline" :ui="{ body: 'px-0 sm:px-0' }">
              <template #header>
                <div class="text-base font-normal">
                  Finish-to-Start依存（{{ selectedTemplate.dependencies.length }}）
                </div>
              </template>
              <ul v-if="selectedTemplate.dependencies.length" class="py-2">
                <li
                  v-for="dependency in selectedTemplate.dependencies"
                  :key="dependency.projectTemplateDependencyId"
                  class="px-4 py-1.5"
                >
                  <div class="text-base">
                    {{
                      formatProjectTemplateTaskTitle(
                        selectedTemplate.tasks,
                        dependency.predecessorProjectTemplateTaskId
                      )
                    }}
                    →
                    {{
                      formatProjectTemplateTaskTitle(
                        selectedTemplate.tasks,
                        dependency.successorProjectTemplateTaskId
                      )
                    }}
                  </div>
                  <div class="text-sm text-muted">待ち時間 {{ dependency.lagMinutes }}分</div>
                </li>
              </ul>
              <div v-else class="px-4 text-muted">保存されたTask依存関係はありません。</div>
            </UCard>
          </template>

          <div
            v-else-if="templates.length && !isLoadingDetail"
            class="rounded-sm border border-default p-8 text-center text-muted"
          >
            左の一覧からTemplateを選択してください。
          </div>
        </div>
      </div>
    </UCard>
  </div>

  <UModal
    v-model:open="isArchiveConfirmOpen"
    :dismissible="!isArchiving"
    title="Project Templateをアーカイブしますか？"
    :ui="{ content: 'max-w-130' }"
  >
    <template #body>
      「{{ selectedTemplate?.name }}」を一覧と適用対象から除外します。
      同じ名前で新しいTemplateをcaptureできるようになります。
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isArchiving" @click="closeArchiveConfirm"
        >キャンセル</UButton
      >
      <UButton color="error" variant="ghost" :loading="isArchiving" @click="archiveTemplate"
        >アーカイブ</UButton
      >
    </template>
  </UModal>
</template>
