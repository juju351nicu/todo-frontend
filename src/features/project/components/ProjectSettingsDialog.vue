<script setup lang="ts">
import { computed } from "vue";

import { useProjectSettingsDialog } from "@/features/project/composables/useProjectSettingsDialog";
import type {
  ProjectDetail,
  ProjectRole,
} from "@/features/project/types/project";

interface Props {
  /** Task Boardが保持する最新Project詳細。更新Responseを受けるたび親画面から差し替える。 */
  project: ProjectDetail;
}

interface Emits {
  /** Projectまたはmember更新後のBackend確定済み詳細を親Boardへ反映する。 */
  (event: "projectUpdated", project: ProjectDetail): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const projectRef = computed(() => props.project);

const {
  activeSection,
  addMember,
  addMemberAccountId,
  addMemberRole,
  archiveProject,
  canAddMember,
  canManageMembers,
  canOpenSettings,
  canSaveMemberRole,
  canSaveProject,
  canUpdateProject,
  closeArchiveConfirm,
  closeDialog,
  closeRemoveConfirm,
  errorMessages,
  isArchiveConfirmOpen,
  isArchivingProject,
  isBusy,
  isCurrentMember,
  isDialogOpen,
  isLastOwner,
  isProjectActive,
  isRemoveConfirmOpen,
  isSavingMember,
  isSavingProject,
  memberRoleDrafts,
  memberToRemove,
  openArchiveConfirm,
  openDialog,
  openRemoveConfirm,
  projectForm,
  projectRoleOptions,
  removeMember,
  saveMemberRole,
  saveProject,
  successMessage,
} = useProjectSettingsDialog(projectRef, (updatedProject) =>
  emit("projectUpdated", updatedProject)
);

/** Project roleコードを画面向けの説明へ変換する。 */
const getProjectRoleDescription = (role: ProjectRole): string =>
  ({
    OWNER: "Project設定・メンバー・Taskを管理",
    MANAGER: "Taskを管理",
    MEMBER: "Taskを参照・担当Taskを更新",
  })[role];
</script>

<template>
  <v-btn
    v-if="canOpenSettings"
    variant="tonal"
    prepend-icon="mdi-cog-outline"
    @click="openDialog"
  >
    Project設定
  </v-btn>

  <v-dialog v-model="isDialogOpen" max-width="960" :persistent="isBusy">
    <v-card>
      <v-card-title class="d-flex align-center flex-wrap ga-2">
        <v-icon icon="mdi-folder-cog-outline" />
        Project設定
        <v-spacer />
        <v-chip
          :color="project.status === 'ACTIVE' ? 'success' : 'default'"
          size="small"
        >
          {{ project.status === "ACTIVE" ? "利用中" : "アーカイブ" }}
        </v-chip>
      </v-card-title>
      <v-card-subtitle>{{ project.projectKey }}</v-card-subtitle>

      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">
            {{ message }}
          </div>
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-4">
          {{ successMessage }}
        </v-alert>
        <v-alert v-if="!isProjectActive" type="info" class="mb-4">
          アーカイブ済みProjectは履歴参照専用です。Project情報とメンバーは変更できません。
        </v-alert>

        <v-tabs v-model="activeSection" class="mb-4">
          <v-tab value="project" prepend-icon="mdi-folder-edit-outline">
            基本情報
          </v-tab>
          <v-tab value="members" prepend-icon="mdi-account-multiple-outline">
            メンバー
          </v-tab>
        </v-tabs>

        <v-window v-model="activeSection">
          <v-window-item value="project">
            <v-text-field
              v-model="projectForm.name"
              label="Project名"
              maxlength="100"
              counter
              :readonly="!canUpdateProject"
              :disabled="isBusy"
            />
            <v-textarea
              v-model="projectForm.description"
              label="説明"
              maxlength="2000"
              counter
              rows="5"
              :readonly="!canUpdateProject"
              :disabled="isBusy"
            />
            <div class="d-flex align-center flex-wrap ga-3 mt-4">
              <v-btn
                v-if="canUpdateProject"
                color="primary"
                prepend-icon="mdi-content-save-outline"
                :loading="isSavingProject"
                :disabled="!canSaveProject"
                @click="saveProject"
              >
                基本情報を保存
              </v-btn>
              <v-spacer />
              <v-btn
                v-if="canUpdateProject"
                color="error"
                variant="outlined"
                prepend-icon="mdi-archive-outline"
                :disabled="isBusy"
                @click="openArchiveConfirm"
              >
                Projectをアーカイブ
              </v-btn>
            </div>
          </v-window-item>

          <v-window-item value="members">
            <v-alert v-if="!canManageMembers" type="info" class="mb-4">
              メンバーを参照できます。変更にはPROJECT_MEMBER_UPDATE permissionとOWNER権限が必要です。
            </v-alert>

            <v-card v-if="canManageMembers" variant="outlined" class="mb-5">
              <v-card-title class="text-subtitle-1">メンバーを追加</v-card-title>
              <v-card-text>
                <v-row align="center">
                  <v-col cols="12" md="5">
                    <v-text-field
                      v-model="addMemberAccountId"
                      label="アカウントID"
                      type="number"
                      min="1"
                      hint="存在し、ACTIVEなアカウントだけを追加できます。"
                      persistent-hint
                      :disabled="isBusy"
                    />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select
                      v-model="addMemberRole"
                      label="Project role"
                      :items="projectRoleOptions"
                      :disabled="isBusy"
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-btn
                      block
                      color="primary"
                      prepend-icon="mdi-account-plus-outline"
                      :loading="isSavingMember"
                      :disabled="!canAddMember"
                      @click="addMember"
                    >
                      追加
                    </v-btn>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>

            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>アカウント</th>
                  <th>Project role</th>
                  <th>割当情報</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="member in project.members" :key="member.accountId">
                  <td>
                    <div class="font-weight-medium">
                      ID: {{ member.accountId }}
                      <v-chip
                        v-if="isCurrentMember(member)"
                        size="x-small"
                        color="primary"
                        class="ml-1"
                      >
                        自分
                      </v-chip>
                    </div>
                    <div class="text-caption text-medium-emphasis">
                      {{ getProjectRoleDescription(member.projectRole) }}
                    </div>
                  </td>
                  <td class="member-role-cell">
                    <v-select
                      v-model="memberRoleDrafts[member.accountId]"
                      :items="projectRoleOptions"
                      density="compact"
                      hide-details
                      :readonly="!canManageMembers"
                      :disabled="isBusy"
                      :aria-label="`アカウントID ${member.accountId} のProject role`"
                    />
                    <div
                      v-if="isLastOwner(member)"
                      class="text-caption text-warning mt-1"
                    >
                      最後のOWNERは降格・除外できません。
                    </div>
                  </td>
                  <td>
                    <div class="text-caption">割当者ID: {{ member.assignedBy }}</div>
                    <div class="text-caption">参加日時: {{ member.joinedAt }}</div>
                    <div class="text-caption">version: {{ member.version }}</div>
                  </td>
                  <td class="text-right">
                    <div v-if="canManageMembers" class="d-flex justify-end ga-2">
                      <v-btn
                        size="small"
                        color="primary"
                        variant="tonal"
                        :loading="isSavingMember"
                        :disabled="!canSaveMemberRole(member)"
                        :aria-label="`アカウントID ${member.accountId} のroleを保存`"
                        @click="saveMemberRole(member)"
                      >
                        role保存
                      </v-btn>
                      <v-btn
                        size="small"
                        color="error"
                        variant="text"
                        icon="mdi-account-remove-outline"
                        :disabled="isBusy || isLastOwner(member)"
                        :aria-label="`アカウントID ${member.accountId} をProjectから除外`"
                        @click="openRemoveConfirm(member)"
                      />
                    </div>
                    <span v-else class="text-medium-emphasis">参照のみ</span>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isBusy" @click="closeDialog">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="isArchiveConfirmOpen"
    max-width="560"
    :persistent="isArchivingProject"
  >
    <v-card>
      <v-card-title class="d-flex align-center text-error">
        <v-icon icon="mdi-archive-alert-outline" class="mr-2" />
        Projectをアーカイブしますか？
      </v-card-title>
      <v-card-text>
        <p class="mb-3">「{{ project.name }}」を履歴参照専用に変更します。</p>
        <v-alert type="warning" variant="tonal">
          MVPではアーカイブ解除できません。Project、メンバー、Taskの更新もできなくなります。
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isArchivingProject" @click="closeArchiveConfirm">
          キャンセル
        </v-btn>
        <v-btn color="error" :loading="isArchivingProject" @click="archiveProject">
          アーカイブする
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="isRemoveConfirmOpen"
    max-width="560"
    :persistent="isSavingMember"
  >
    <v-card v-if="memberToRemove">
      <v-card-title class="d-flex align-center text-error">
        <v-icon icon="mdi-account-remove-outline" class="mr-2" />
        Projectから除外しますか？
      </v-card-title>
      <v-card-text>
        <p>アカウントID {{ memberToRemove.accountId }} のmembershipを削除します。</p>
        <v-alert
          v-if="isCurrentMember(memberToRemove)"
          type="warning"
          variant="tonal"
          class="mt-3"
        >
          自分を除外すると、このProjectを参照できなくなりProject一覧へ戻ります。
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="isSavingMember" @click="closeRemoveConfirm">
          キャンセル
        </v-btn>
        <v-btn color="error" :loading="isSavingMember" @click="removeMember">
          除外する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.member-role-cell {
  min-width: 210px;
}
</style>
