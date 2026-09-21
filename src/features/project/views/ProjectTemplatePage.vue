<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useProjectTemplatePage } from "@/features/project/composables/useProjectTemplatePage";
import type {
  ProjectTemplateTask,
  ProjectTemplateTaskType,
} from "@/features/project/types/projectTemplate";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

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
  errorMessage,
  initialize,
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

/** Task種別コードを画面表示へ変換する。 */
const getTaskTypeLabel = (taskType: ProjectTemplateTaskType): string =>
  ({ SUMMARY: "Summary", TASK: "Task", MILESTONE: "Milestone" })[taskType];

/** 優先度コードを日本語表示へ変換する。 */
const getPriorityLabel = (priority: ProjectTemplateTask["priority"]): string =>
  ({ 1: "低", 2: "中", 3: "高" })[priority];

/** signed day offsetを基準日前後の表示へ変換する。 */
const formatOffset = (offsetDays: number): string =>
  offsetDays === 0
    ? "基準日"
    : offsetDays > 0
      ? `+${offsetDays}日`
      : `${offsetDays}日`;

/** snapshot IDに対応するTask表示名を依存関係一覧へ返す。 */
const getTaskTitle = (taskId: number): string => {
  const task = selectedTemplate.value?.tasks.find(
    (candidate) => candidate.projectTemplateTaskId === taskId
  );
  return task ? `${task.wbsCode ? `${task.wbsCode} ` : ""}${task.title}` : `ID: ${taskId}`;
};

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <LoadingIndicator v-if="isLoadingList || isLoadingDetail" />
  <v-container fluid class="pa-6 project-template-page">
    <v-card class="mx-auto" max-width="1440">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-folder-multiple-outline" />
        Project Template
        <v-spacer />
        <v-btn
          :to="{ name: 'ProjectList' }"
          variant="text"
          prepend-icon="mdi-view-dashboard-outline"
        >
          Project一覧
        </v-btn>
      </v-card-title>
      <v-card-subtitle>
        Project、member role、Board列、WBS構造を再利用する本人専用Templateです。
      </v-card-subtitle>

      <v-card-text>
        <v-alert v-if="errorMessage" type="error" class="mb-4">
          {{ errorMessage }}
        </v-alert>
        <v-alert v-if="successMessage" type="success" closable class="mb-4">
          {{ successMessage }}
        </v-alert>

        <v-row>
          <v-col cols="12" lg="3">
            <div class="text-subtitle-1 font-weight-bold mb-2">
              本人所有Template
            </div>
            <v-list v-if="templates.length" border rounded>
              <v-list-item
                v-for="template in templates"
                :key="template.projectTemplateId"
                :active="selectedTemplate?.projectTemplateId === template.projectTemplateId"
                :title="template.name"
                :subtitle="`基準日 ${template.baseDate}・version ${template.version}`"
                :disabled="isMutating || isLoadingDetail"
                @click="selectTemplate(template)"
              >
                <template #prepend>
                  <v-icon icon="mdi-folder-star-outline" />
                </template>
              </v-list-item>
            </v-list>
            <v-sheet
              v-else-if="!isLoadingList"
              border
              rounded
              class="pa-5 text-center text-medium-emphasis"
            >
              保存済みTemplateはありません。OWNERはProject Boardから現在の構造を保存できます。
            </v-sheet>
          </v-col>

          <v-col cols="12" lg="9">
            <v-progress-linear
              v-if="isLoadingDetail"
              indeterminate
              color="primary"
              class="mb-4"
            />

            <template v-if="selectedTemplate">
              <div v-if="!isEditing" class="d-flex align-start flex-wrap ga-2 mb-4">
                <div>
                  <h1 class="text-h5">{{ selectedTemplate.name }}</h1>
                  <div class="text-body-2 text-medium-emphasis">
                    基準日 {{ selectedTemplate.baseDate }}・version {{ selectedTemplate.version }}
                    <span v-if="selectedTemplate.sourceProjectId !== null">
                      ・capture元Project ID {{ selectedTemplate.sourceProjectId }}
                    </span>
                  </div>
                </div>
                <v-spacer />
                <v-btn
                  v-if="canEditTemplate"
                  variant="text"
                  prepend-icon="mdi-pencil-outline"
                  :disabled="isMutating"
                  @click="beginEditing"
                >
                  編集
                </v-btn>
                <v-btn
                  v-if="canEditTemplate"
                  color="error"
                  variant="text"
                  prepend-icon="mdi-archive-outline"
                  :disabled="isMutating"
                  @click="openArchiveConfirm"
                >
                  アーカイブ
                </v-btn>
              </div>

              <v-form v-if="isEditing" class="mb-5" @submit.prevent="saveTemplate">
                <v-card variant="outlined">
                  <v-card-title class="text-subtitle-1">Template headerを編集</v-card-title>
                  <v-card-text>
                    <v-text-field
                      v-model="editForm.name"
                      label="Template名"
                      maxlength="100"
                      counter
                      :disabled="isSaving"
                    />
                    <v-textarea
                      v-model="editForm.description"
                      label="生成Projectへ複製する説明"
                      maxlength="2000"
                      counter
                      rows="4"
                      :disabled="isSaving"
                    />
                    <v-alert type="info" variant="tonal" density="compact">
                      member slot、Board列、Task、checklist、依存関係のsnapshotは編集されません。
                    </v-alert>
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer />
                    <v-btn :disabled="isSaving" @click="cancelEditing">
                      キャンセル
                    </v-btn>
                    <v-btn type="submit" color="primary" :loading="isSaving">
                      保存
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-form>

              <p v-if="!isEditing" class="template-description mb-5">
                {{ selectedTemplate.description || "説明はありません。" }}
              </p>

              <v-card variant="outlined" class="mb-5">
                <v-card-title class="d-flex align-center flex-wrap ga-2 text-subtitle-1">
                  <v-icon icon="mdi-playlist-plus" />
                  TemplateからProjectを作成
                  <v-spacer />
                  <v-chip size="small">{{ selectedTemplate.memberSlots.length }} member slot</v-chip>
                </v-card-title>
                <v-card-text>
                  <v-alert
                    v-if="!canApplyTemplate"
                    type="info"
                    variant="tonal"
                    density="compact"
                    class="mb-4"
                  >
                    Project作成にはPROJECT_CREATE permissionが必要です。
                  </v-alert>
                  <v-row>
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="applyForm.projectKey"
                        label="Projectキー"
                        maxlength="30"
                        counter
                        hint="大文字英数字をハイフンで区切ります。"
                        persistent-hint
                        :disabled="!canApplyTemplate || isMutating"
                      />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="applyForm.name"
                        label="Project名"
                        maxlength="100"
                        counter
                        :disabled="!canApplyTemplate || isMutating"
                      />
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-text-field
                        v-model="applyForm.projectStartDate"
                        label="Project開始日"
                        type="date"
                        :disabled="!canApplyTemplate || isMutating"
                      />
                    </v-col>
                  </v-row>

                  <div class="text-subtitle-2 mt-2 mb-2">member slot mapping</div>
                  <v-row>
                    <v-col
                      v-for="slot in selectedTemplate.memberSlots"
                      :key="slot.slotKey"
                      cols="12"
                      md="6"
                    >
                      <v-text-field
                        v-model.number="applyForm.memberMappings[slot.slotKey]"
                        :label="`${slot.displayName}（${slot.projectRole}）`"
                        type="number"
                        min="1"
                        :hint="slot.slotKey === 'OWNER_1' ? '未指定時は自分を割り当てます。' : `slot: ${slot.slotKey}`"
                        persistent-hint
                        :disabled="!canApplyTemplate || isMutating"
                      />
                    </v-col>
                  </v-row>
                  <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                    各slotへ異なるACTIVEアカウントIDを割り当ててください。自分はOWNERとして参加する必要があります。
                  </v-alert>
                  <div class="d-flex justify-end">
                    <v-btn
                      color="primary"
                      prepend-icon="mdi-folder-plus-outline"
                      :loading="isApplying"
                      :disabled="!canApplyTemplate || isMutating"
                      @click="applyTemplate"
                    >
                      Projectを作成してBoardを開く
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>

              <v-row class="mb-2">
                <v-col cols="12" md="6">
                  <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">
                      member slot（{{ selectedTemplate.memberSlots.length }}）
                    </v-card-title>
                    <v-list density="compact">
                      <v-list-item
                        v-for="slot in selectedTemplate.memberSlots"
                        :key="slot.slotKey"
                        :title="slot.displayName"
                        :subtitle="`${slot.slotKey}・${slot.projectRole}`"
                      />
                    </v-list>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card variant="outlined" height="100%">
                    <v-card-title class="text-subtitle-1">
                      Board列（{{ selectedTemplate.statuses.length }}）
                    </v-card-title>
                    <v-list density="compact">
                      <v-list-item
                        v-for="status in selectedTemplate.statuses"
                        :key="status.statusCode"
                        :title="status.name"
                        :subtitle="status.statusCode"
                      >
                        <template #append>
                          <v-chip v-if="status.completed" size="x-small" color="success">
                            完了列
                          </v-chip>
                        </template>
                      </v-list-item>
                    </v-list>
                  </v-card>
                </v-col>
              </v-row>

              <v-card variant="outlined" class="mb-5">
                <v-card-title class="text-subtitle-1">
                  WBS Task snapshot（{{ selectedTemplate.tasks.length }}）
                </v-card-title>
                <div class="template-table-scroll">
                  <v-table density="compact">
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
                      <tr
                        v-for="task in selectedTemplate.tasks"
                        :key="task.projectTemplateTaskId"
                      >
                        <td>
                          <div class="font-weight-medium">
                            {{ task.wbsCode || "-" }} {{ task.title }}
                          </div>
                          <div
                            v-if="task.detail"
                            class="text-caption template-task-detail"
                          >
                            {{ task.detail }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            snapshot ID {{ task.projectTemplateTaskId }}
                            <span v-if="task.parentProjectTemplateTaskId !== null">
                              ・親 {{ task.parentProjectTemplateTaskId }}
                            </span>
                          </div>
                        </td>
                        <td>{{ getTaskTypeLabel(task.taskType) }}</td>
                        <td>{{ task.statusCode }}</td>
                        <td>{{ task.assigneeSlotKey }}</td>
                        <td>
                          {{ formatOffset(task.startOffsetDays) }} ～
                          {{ formatOffset(task.dueOffsetDays) }}
                        </td>
                        <td>
                          {{ task.plannedEffortMinutes }}分・{{ getPriorityLabel(task.priority) }}
                        </td>
                        <td>
                          <ul
                            v-if="task.checklistItems.length"
                            class="template-checklist"
                          >
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
                  </v-table>
                </div>
              </v-card>

              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Finish-to-Start依存（{{ selectedTemplate.dependencies.length }}）
                </v-card-title>
                <v-list v-if="selectedTemplate.dependencies.length" density="compact">
                  <v-list-item
                    v-for="dependency in selectedTemplate.dependencies"
                    :key="dependency.projectTemplateDependencyId"
                    :title="`${getTaskTitle(dependency.predecessorProjectTemplateTaskId)} → ${getTaskTitle(dependency.successorProjectTemplateTaskId)}`"
                    :subtitle="`待ち時間 ${dependency.lagMinutes}分`"
                  />
                </v-list>
                <v-card-text v-else class="text-medium-emphasis">
                  保存されたTask依存関係はありません。
                </v-card-text>
              </v-card>
            </template>

            <v-sheet
              v-else-if="templates.length && !isLoadingDetail"
              border
              rounded
              class="pa-8 text-center text-medium-emphasis"
            >
              左の一覧からTemplateを選択してください。
            </v-sheet>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>

  <v-dialog
    v-model="isArchiveConfirmOpen"
    max-width="520"
    :persistent="isArchiving"
  >
    <v-card>
      <v-card-title>Project Templateをアーカイブしますか？</v-card-title>
      <v-card-text>
        「{{ selectedTemplate?.name }}」を一覧と適用対象から除外します。
        同じ名前で新しいTemplateをcaptureできるようになります。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isArchiving" @click="closeArchiveConfirm">
          キャンセル
        </v-btn>
        <v-btn color="error" :loading="isArchiving" @click="archiveTemplate">
          アーカイブ
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.project-template-page {
  min-height: calc(100vh - 64px);
  background: rgb(var(--v-theme-surface-variant));
}

.template-description {
  white-space: pre-wrap;
}

.template-table-scroll {
  overflow-x: auto;
}

.template-task-detail {
  max-width: 28rem;
  white-space: pre-wrap;
}

.template-checklist {
  min-width: 12rem;
  padding-left: 1.25rem;
}
</style>
