<script setup lang="ts">
import { computed, ref, toRef } from "vue";

import type {
  ProjectMember,
  TaskDetail,
  TaskPriority,
  TaskStatus,
} from "@/features/project/types/project";
import { useTaskTemplates } from "@/features/task/composables/useTaskTemplates";

const props = withDefaults(
  defineProps<{
    projectId: number;
    members: ProjectMember[];
    statuses: TaskStatus[];
    canApply?: boolean;
    canEdit?: boolean;
    projectActive?: boolean;
  }>(),
  { canApply: false, canEdit: false, projectActive: false }
);
const emit = defineEmits<{
  taskCreated: [task: TaskDetail];
}>();

const isOpen = ref(false);
const isArchiveConfirmOpen = ref(false);
const {
  applyAssigneeAccountId,
  applyDateFrom,
  applyTaskStatusId,
  applyTemplate,
  archiveTemplate,
  beginEditing,
  cancelEditing,
  editForm,
  errorMessage,
  isApplying,
  isArchiving,
  isEditing,
  isLoading,
  isMutating,
  isSaving,
  loadTemplates,
  saveTemplate,
  selectTemplate,
  selectedTemplate,
  successMessage,
  templates,
} = useTaskTemplates(toRef(props, "projectId"));

const memberOptions = computed(() =>
  props.members.map((member) => ({
    title: `アカウントID: ${member.accountId}（${member.projectRole}）`,
    value: member.accountId,
  }))
);
const statusIdOptions = computed(() =>
  props.statuses.map((status) => ({
    title: status.name,
    value: status.taskStatusId,
  }))
);
const statusCodeOptions = computed(() =>
  props.statuses.map((status) => ({
    title: `${status.name}（${status.statusCode}）`,
    value: status.statusCode,
  }))
);
const priorityOptions: Array<{ title: string; value: TaskPriority }> = [
  { title: "低", value: 1 },
  { title: "中", value: 2 },
  { title: "高", value: 3 },
];

/** Dialogを開くたびに本人所有Templateの最新一覧を取得する。 */
const open = async (): Promise<void> => {
  isOpen.value = true;
  await loadTemplates();
};

/** TemplateからTaskを生成し、親Boardへ再取得対象を通知する。 */
const applySelectedTemplate = async (): Promise<void> => {
  const created = await applyTemplate();
  if (created === null) return;
  isOpen.value = false;
  emit("taskCreated", created);
};

/** archive確認後にTemplateを論理削除する。 */
const confirmArchive = async (): Promise<void> => {
  await archiveTemplate();
  isArchiveConfirmOpen.value = false;
};
</script>

<template>
  <v-btn
    prepend-icon="mdi-file-multiple-outline"
    variant="tonal"
    @click="open"
  >
    Task Template
  </v-btn>

  <v-dialog v-model="isOpen" max-width="1040" :persistent="isMutating">
    <v-card>
      <v-card-title class="d-flex align-center">
        Task Template
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" :disabled="isMutating" @click="isOpen = false" />
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
        <v-progress-linear v-if="isLoading" indeterminate color="primary" class="mb-3" />

        <v-row>
          <v-col cols="12" md="4">
            <div class="text-subtitle-1 font-weight-bold mb-2">本人所有Template</div>
            <v-list v-if="templates.length" density="compact" border rounded>
              <v-list-item
                v-for="template in templates"
                :key="template.taskTemplateId"
                :active="selectedTemplate?.taskTemplateId === template.taskTemplateId"
                :title="template.name"
                :subtitle="template.title"
                @click="selectTemplate(template)"
              >
                <template #append>
                  <v-chip size="x-small">{{ template.checklistItems.length }}項目</v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="!isLoading" class="text-body-2 text-medium-emphasis">
              保存済みTemplateはありません。Task詳細の「Templateとして保存」から作成できます。
            </div>
          </v-col>

          <v-col cols="12" md="8">
            <div v-if="selectedTemplate && !isEditing">
              <div class="d-flex align-center flex-wrap ga-2 mb-3">
                <h2 class="text-h6">{{ selectedTemplate.name }}</h2>
                <v-chip size="small">期限 +{{ selectedTemplate.dueOffsetDays }}日</v-chip>
                <v-chip size="small">予定 {{ selectedTemplate.plannedEffortMinutes }}分</v-chip>
                <v-spacer />
                <v-btn
                  v-if="canEdit"
                  size="small"
                  variant="text"
                  prepend-icon="mdi-pencil-outline"
                  :disabled="isMutating"
                  @click="beginEditing"
                >
                  編集
                </v-btn>
                <v-btn
                  v-if="canEdit"
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
              <div class="text-subtitle-1 mb-1">{{ selectedTemplate.title }}</div>
              <p class="text-body-2 text-medium-emphasis template-detail mb-4">
                {{ selectedTemplate.detail }}
              </p>
              <v-list v-if="selectedTemplate.checklistItems.length" density="compact" class="mb-4" border rounded>
                <v-list-item
                  v-for="item in selectedTemplate.checklistItems"
                  :key="item.position"
                  prepend-icon="mdi-checkbox-blank-outline"
                  :title="item.content"
                />
              </v-list>

              <v-divider class="mb-4" />
              <div class="text-subtitle-1 font-weight-bold mb-3">このProjectへ適用</div>
              <v-alert v-if="!projectActive" type="info" density="compact" class="mb-3">
                アーカイブ済みProjectにはTemplateを適用できません。
              </v-alert>
              <v-row>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="applyDateFrom"
                    label="開始日"
                    type="date"
                    :disabled="!canApply || !projectActive || isMutating"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select
                    v-model="applyAssigneeAccountId"
                    label="担当者上書き"
                    :items="memberOptions"
                    clearable
                    persistent-hint
                    hint="未指定時はTemplate既定値"
                    :disabled="!canApply || !projectActive || isMutating"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select
                    v-model="applyTaskStatusId"
                    label="Board列上書き"
                    :items="statusIdOptions"
                    clearable
                    persistent-hint
                    hint="未指定時はTemplate既定列"
                    :disabled="!canApply || !projectActive || isMutating"
                  />
                </v-col>
              </v-row>
              <div class="d-flex justify-end">
                <v-btn
                  color="primary"
                  prepend-icon="mdi-playlist-plus"
                  :loading="isApplying"
                  :disabled="!canApply || !projectActive || isMutating"
                  @click="applySelectedTemplate"
                >
                  Taskを作成
                </v-btn>
              </div>
            </div>

            <v-form v-else-if="selectedTemplate && isEditing" @submit.prevent="saveTemplate">
              <div class="text-subtitle-1 font-weight-bold mb-3">Templateを編集</div>
              <v-text-field v-model="editForm.name" label="Template名" maxlength="100" counter />
              <v-text-field v-model="editForm.title" label="Taskタイトル" maxlength="45" counter />
              <v-textarea v-model="editForm.detail" label="Task詳細" maxlength="1000" counter rows="3" />
              <v-row>
                <v-col cols="12" sm="6">
                  <v-select v-model="editForm.priority" label="優先度" :items="priorityOptions" />
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select
                    v-model="editForm.defaultStatusCode"
                    label="既定Board列"
                    :items="statusCodeOptions"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="editForm.dueOffsetDays"
                    label="期限オフセット（日）"
                    type="number"
                    min="0"
                    max="365"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model.number="editForm.plannedEffortMinutes"
                    label="予定工数（分）"
                    type="number"
                    min="0"
                  />
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select
                    v-model="editForm.defaultAssigneeAccountId"
                    label="既定担当者"
                    :items="memberOptions"
                    clearable
                  />
                </v-col>
              </v-row>
              <v-combobox
                v-model="editForm.checklistContents"
                label="チェック項目"
                hint="入力後にEnterで項目を追加します（最大50件）"
                persistent-hint
                multiple
                chips
                closable-chips
              />
              <div class="d-flex justify-end ga-2 mt-4">
                <v-btn :disabled="isSaving" @click="cancelEditing">キャンセル</v-btn>
                <v-btn type="submit" color="primary" :loading="isSaving">更新</v-btn>
              </div>
            </v-form>

            <div v-else class="text-body-2 text-medium-emphasis pa-4">
              左の一覧からTemplateを選択してください。
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="isArchiveConfirmOpen" max-width="480" :persistent="isArchiving">
    <v-card>
      <v-card-title>Task Templateをアーカイブしますか？</v-card-title>
      <v-card-text>{{ selectedTemplate?.name }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isArchiving" @click="isArchiveConfirmOpen = false">キャンセル</v-btn>
        <v-btn color="error" :loading="isArchiving" @click="confirmArchive">アーカイブ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.template-detail {
  white-space: pre-wrap;
}
</style>
