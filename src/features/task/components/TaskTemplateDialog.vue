<script setup lang="ts">
import { toRef } from "vue";

import type { ProjectMember, TaskDetail, TaskStatus } from "@/features/project/types/project";
import { useTaskTemplateDialog } from "@/features/task/composables/useTaskTemplateDialog";
import { TASK_PRIORITY_OPTIONS } from "@/features/task/utils/taskFormOptions";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const props = withDefaults(
  defineProps<{
    projectId: number;
    members: ProjectMember[];
    statuses: TaskStatus[];
    canApply?: boolean;
    canEdit?: boolean;
    projectActive?: boolean;
  }>(),
  { canApply: false, canEdit: false, projectActive: false },
);
const emit = defineEmits<{
  taskCreated: [task: TaskDetail];
}>();

const {
  applyAssigneeAccountId,
  applyDateFrom,
  applySelectedTemplate,
  applyTaskStatusId,
  beginEditing,
  cancelEditing,
  confirmArchive,
  editForm,
  errorMessage,
  isApplying,
  isArchiveConfirmOpen,
  isArchiving,
  isEditing,
  isLoading,
  isMutating,
  isOpen,
  isSaving,
  memberOptions,
  open,
  saveTemplate,
  selectTemplate,
  selectedTemplate,
  statusCodeOptions,
  statusIdOptions,
  successMessage,
  templates,
} = useTaskTemplateDialog({
  projectId: toRef(props, "projectId"),
  members: () => props.members,
  statuses: () => props.statuses,
  onTaskCreated: (task) => emit("taskCreated", task),
});
</script>

<template>
  <UButton icon="i-mdi-file-multiple-outline" variant="soft" class="text-white" @click="open">Task Template</UButton>

  <UModal v-model:open="isOpen" :dismissible="!isMutating" :ui="{ content: 'max-w-260' }">
    <template #title>
      <span class="flex items-center">
        Task Template
        <UButton
          icon="i-mdi-close"
          variant="ghost"
          square
          class="ms-auto"
          aria-label="閉じる"
          :disabled="isMutating"
          @click="isOpen = false"
        />
      </span>
    </template>
    <template #body>
      <StatusAlert v-if="errorMessage" type="error" density="compact" class="mb-3">{{ errorMessage }}</StatusAlert>
      <StatusAlert v-if="successMessage" type="success" density="compact" closable class="mb-3" @close="successMessage = ''">
        {{ successMessage }}
      </StatusAlert>
      <UProgress v-if="isLoading" size="xs" class="mb-3" />

      <div class="-m-3 flex flex-wrap">
        <div class="w-full p-3 md:w-1/3">
          <div class="mb-2 text-base font-bold">本人所有Template</div>
          <ul v-if="templates.length" class="rounded-sm border border-default py-2">
            <li v-for="template in templates" :key="template.taskTemplateId">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-1.5 text-start"
                :class="selectedTemplate?.taskTemplateId === template.taskTemplateId ? 'bg-primary/12 text-primary' : 'hover:bg-black/4'"
                @click="selectTemplate(template)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-base">{{ template.name }}</span>
                  <span class="block truncate text-sm opacity-60">{{ template.title }}</span>
                </span>
                <UBadge size="xs">{{ template.checklistItems.length }}項目</UBadge>
              </button>
            </li>
          </ul>
          <div v-else-if="!isLoading" class="text-sm text-muted">
            保存済みTemplateはありません。Task詳細の「Templateとして保存」から作成できます。
          </div>
        </div>

        <div class="w-full p-3 md:w-2/3">
          <div v-if="selectedTemplate && !isEditing">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-medium">{{ selectedTemplate.name }}</h2>
              <UBadge size="sm">期限 +{{ selectedTemplate.dueOffsetDays }}日</UBadge>
              <UBadge size="sm">予定 {{ selectedTemplate.plannedEffortMinutes }}分</UBadge>
              <UButton
                v-if="canEdit"
                size="sm"
                variant="ghost"
                icon="i-mdi-pencil-outline"
                class="ms-auto"
                :disabled="isMutating"
                @click="beginEditing"
              >
                編集
              </UButton>
              <UButton
                v-if="canEdit"
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
            <div class="mb-1 text-base">{{ selectedTemplate.title }}</div>
            <p class="mb-4 text-sm whitespace-pre-wrap text-muted">{{ selectedTemplate.detail }}</p>
            <ul v-if="selectedTemplate.checklistItems.length" class="mb-4 rounded-sm border border-default py-2">
              <li v-for="item in selectedTemplate.checklistItems" :key="item.position" class="flex items-center gap-8 px-4 py-1.5">
                <UIcon name="i-mdi-checkbox-blank-outline" class="size-6 opacity-60" />
                <span class="text-base">{{ item.content }}</span>
              </li>
            </ul>

            <USeparator class="mb-4" />
            <div class="mb-3 text-base font-bold">このProjectへ適用</div>
            <StatusAlert v-if="!projectActive" type="info" density="compact" class="mb-3">
              アーカイブ済みProjectにはTemplateを適用できません。
            </StatusAlert>
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="開始日">
                  <UInput v-model="applyDateFrom" type="date" :disabled="!canApply || !projectActive || isMutating" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="担当者上書き" help="未指定時はTemplate既定値">
                  <USelectMenu
                    :model-value="applyAssigneeAccountId ?? undefined"
                    :items="memberOptions"
                    label-key="title"
                    value-key="value"
                    :search-input="false"
                    clear
                    :disabled="!canApply || !projectActive || isMutating"
                    class="w-full"
                    @update:model-value="applyAssigneeAccountId = $event ?? null"
                    @clear="applyAssigneeAccountId = null"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="Board列上書き" help="未指定時はTemplate既定列">
                  <USelectMenu
                    :model-value="applyTaskStatusId ?? undefined"
                    :items="statusIdOptions"
                    label-key="title"
                    value-key="value"
                    :search-input="false"
                    clear
                    :disabled="!canApply || !projectActive || isMutating"
                    class="w-full"
                    @update:model-value="applyTaskStatusId = $event ?? null"
                    @clear="applyTaskStatusId = null"
                  />
                </UFormField>
              </div>
            </div>
            <div class="flex justify-end">
              <UButton
                color="primary"
                icon="i-mdi-playlist-plus"
                :loading="isApplying"
                :disabled="!canApply || !projectActive || isMutating"
                @click="applySelectedTemplate"
              >
                Taskを作成
              </UButton>
            </div>
          </div>

          <form v-else-if="selectedTemplate && isEditing" @submit.prevent="saveTemplate">
            <div class="mb-3 text-base font-bold">Templateを編集</div>
            <div class="relative">
              <UFormField label="Template名">
                <UInput v-model="editForm.name" :maxlength="100" class="w-full" />
              </UFormField>
              <FieldCounter :value="editForm.name" :max="100" />
            </div>
            <div class="relative">
              <UFormField label="Taskタイトル">
                <UInput v-model="editForm.title" :maxlength="45" class="w-full" />
              </UFormField>
              <FieldCounter :value="editForm.title" :max="45" />
            </div>
            <div class="relative">
              <UFormField label="Task詳細">
                <UTextarea v-model="editForm.detail" :maxlength="1000" :rows="3" class="w-full" />
              </UFormField>
              <FieldCounter :value="editForm.detail" :max="1000" />
            </div>
            <div class="-m-3 flex flex-wrap">
              <div class="w-full p-3 sm:w-1/2">
                <UFormField label="優先度">
                  <USelect v-model="editForm.priority" :items="[...TASK_PRIORITY_OPTIONS]" label-key="title" value-key="value" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/2">
                <UFormField label="既定Board列">
                  <USelect
                    v-model="editForm.defaultStatusCode"
                    :items="statusCodeOptions"
                    label-key="title"
                    value-key="value"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="期限オフセット（日）">
                  <UInput v-model.number="editForm.dueOffsetDays" type="number" min="0" max="365" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="予定工数（分）">
                  <UInput v-model.number="editForm.plannedEffortMinutes" type="number" min="0" class="w-full" />
                </UFormField>
              </div>
              <div class="w-full p-3 sm:w-1/3">
                <UFormField label="既定担当者">
                  <USelectMenu
                    :model-value="editForm.defaultAssigneeAccountId ?? undefined"
                    :items="memberOptions"
                    label-key="title"
                    value-key="value"
                    :search-input="false"
                    clear
                    class="w-full"
                    @update:model-value="editForm.defaultAssigneeAccountId = $event ?? null"
                    @clear="editForm.defaultAssigneeAccountId = null"
                  />
                </UFormField>
              </div>
            </div>
            <UFormField label="チェック項目" help="入力後にEnterで項目を追加します（最大50件）">
              <UInputTags v-model="editForm.checklistContents" :max="50" class="w-full" />
            </UFormField>
            <div class="mt-4 flex justify-end gap-2">
              <UButton :disabled="isSaving" @click="cancelEditing">キャンセル</UButton>
              <UButton type="submit" color="primary" :loading="isSaving">更新</UButton>
            </div>
          </form>

          <div v-else class="p-4 text-sm text-muted">左の一覧からTemplateを選択してください。</div>
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="isArchiveConfirmOpen"
    :dismissible="!isArchiving"
    title="Task Templateをアーカイブしますか？"
    :ui="{ content: 'max-w-120' }"
  >
    <template #body>{{ selectedTemplate?.name }}</template>
    <template #footer>
      <UButton variant="ghost" :disabled="isArchiving" @click="isArchiveConfirmOpen = false">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isArchiving" @click="confirmArchive">アーカイブ</UButton>
    </template>
  </UModal>
</template>
