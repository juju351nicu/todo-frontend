<script setup lang="ts">
import { computed } from "vue";

import { useProjectSettingsDialog } from "@/features/project/composables/useProjectSettingsDialog";
import type { ProjectDetail } from "@/features/project/types/project";
import { getProjectRoleDescription } from "@/features/project/utils/projectRole";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

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

const SECTION_TABS = [
  { label: "基本情報", icon: "i-mdi-folder-edit-outline", value: "project", slot: "project" as const },
  { label: "メンバー", icon: "i-mdi-account-multiple-outline", value: "members", slot: "members" as const },
];
</script>

<template>
  <UButton v-if="canOpenSettings" variant="soft" icon="i-mdi-cog-outline" @click="openDialog">Project設定</UButton>

  <UModal v-model:open="isDialogOpen" :dismissible="!isBusy" :description="project.projectKey" :ui="{ content: 'max-w-240' }">
    <template #title>
      <span class="flex flex-wrap items-center gap-2">
        <UIcon name="i-mdi-folder-cog-outline" class="size-6" />
        Project設定
        <UBadge :color="project.status === 'ACTIVE' ? 'success' : 'neutral'" size="sm" class="ms-auto">
          {{ project.status === "ACTIVE" ? "利用中" : "アーカイブ" }}
        </UBadge>
      </span>
    </template>
    <template #body>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-4">{{ successMessage }}</StatusAlert>
      <StatusAlert v-if="!isProjectActive" type="info" class="mb-4">
        アーカイブ済みProjectは履歴参照専用です。Project情報とメンバーは変更できません。
      </StatusAlert>

      <UTabs
        :model-value="activeSection"
        :items="SECTION_TABS"
        class="mb-4"
        @update:model-value="activeSection = $event === 'members' ? 'members' : 'project'"
      >
        <template #project>
          <div class="relative">
            <UFormField label="Project名">
              <UInput
                v-model="projectForm.name"
                :maxlength="100"
                :readonly="!canUpdateProject"
                :disabled="isBusy"
                class="w-full"
              />
            </UFormField>
            <FieldCounter :value="projectForm.name" :max="100" />
          </div>
          <div class="relative">
            <UFormField label="説明">
              <UTextarea
                v-model="projectForm.description"
                :maxlength="2000"
                :rows="5"
                :readonly="!canUpdateProject"
                :disabled="isBusy"
                class="w-full"
              />
            </UFormField>
            <FieldCounter :value="projectForm.description" :max="2000" />
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <UButton
              v-if="canUpdateProject"
              color="primary"
              icon="i-mdi-content-save-outline"
              :loading="isSavingProject"
              :disabled="!canSaveProject"
              @click="saveProject"
            >
              基本情報を保存
            </UButton>
            <UButton
              v-if="canUpdateProject"
              color="error"
              variant="outline"
              icon="i-mdi-archive-outline"
              class="ms-auto"
              :disabled="isBusy"
              @click="openArchiveConfirm"
            >
              Projectをアーカイブ
            </UButton>
          </div>
        </template>

        <template #members>
          <StatusAlert v-if="!canManageMembers" type="info" class="mb-4">
            メンバーを参照できます。変更にはPROJECT_MEMBER_UPDATE permissionとOWNER権限が必要です。
          </StatusAlert>

          <UCard v-if="canManageMembers" variant="outline" class="mb-5">
            <template #header>
              <div class="text-base font-normal">メンバーを追加</div>
            </template>
            <div class="-m-3 flex flex-wrap items-center">
              <div class="w-full p-3 md:w-5/12">
                <UFormField label="アカウントID" help="存在し、ACTIVEなアカウントだけを追加できます。">
                  <UInput
                    :model-value="String(addMemberAccountId ?? '')"
                    type="number"
                    min="1"
                    :disabled="isBusy"
                    class="w-full"
                    @update:model-value="addMemberAccountId = $event"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/3">
                <UFormField label="Project role">
                  <USelect
                    v-model="addMemberRole"
                    :items="projectRoleOptions"
                    label-key="title"
                    value-key="value"
                    :disabled="isBusy"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="w-full p-3 md:w-1/4">
                <UButton
                  block
                  color="primary"
                  icon="i-mdi-account-plus-outline"
                  :loading="isSavingMember"
                  :disabled="!canAddMember"
                  @click="addMember"
                >
                  追加
                </UButton>
              </div>
            </div>
          </UCard>

          <table class="app-table [&_td]:h-12 [&_td]:py-2 [&_th]:h-12">
            <thead>
              <tr>
                <th>アカウント</th>
                <th>Project role</th>
                <th>割当情報</th>
                <th class="text-end!">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="member in project.members" :key="member.accountId">
                <td>
                  <div class="font-medium">
                    ID: {{ member.accountId }}
                    <UBadge v-if="isCurrentMember(member)" size="xs" color="primary" class="ms-1">自分</UBadge>
                  </div>
                  <div class="text-xs text-muted">{{ getProjectRoleDescription(member.projectRole) }}</div>
                </td>
                <td class="min-w-52.5">
                  <USelect
                    v-model="memberRoleDrafts[member.accountId]"
                    :items="projectRoleOptions"
                    label-key="title"
                    value-key="value"
                    size="sm"
                    :disabled="isBusy || !canManageMembers"
                    :aria-label="`アカウントID ${member.accountId} のProject role`"
                    class="w-full"
                  />
                  <div v-if="isLastOwner(member)" class="mt-1 text-xs text-warning">最後のOWNERは降格・除外できません。</div>
                </td>
                <td>
                  <div class="text-xs">割当者ID: {{ member.assignedBy }}</div>
                  <div class="text-xs">参加日時: {{ member.joinedAt }}</div>
                  <div class="text-xs">version: {{ member.version }}</div>
                </td>
                <td class="text-end">
                  <div v-if="canManageMembers" class="flex justify-end gap-2">
                    <UButton
                      size="sm"
                      color="primary"
                      variant="soft"
                      :loading="isSavingMember"
                      :disabled="!canSaveMemberRole(member)"
                      :aria-label="`アカウントID ${member.accountId} のroleを保存`"
                      @click="saveMemberRole(member)"
                    >
                      role保存
                    </UButton>
                    <UButton
                      size="sm"
                      color="error"
                      variant="ghost"
                      square
                      icon="i-mdi-account-remove-outline"
                      :disabled="isBusy || isLastOwner(member)"
                      :aria-label="`アカウントID ${member.accountId} をProjectから除外`"
                      @click="openRemoveConfirm(member)"
                    />
                  </div>
                  <span v-else class="text-muted">参照のみ</span>
                </td>
              </tr>
            </tbody>
          </table>
        </template>
      </UTabs>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isBusy" @click="closeDialog">閉じる</UButton>
    </template>
  </UModal>

  <UModal v-model:open="isArchiveConfirmOpen" :dismissible="!isArchivingProject" :ui="{ content: 'max-w-140' }">
    <template #title>
      <span class="flex items-center text-error">
        <UIcon name="i-mdi-archive-alert-outline" class="me-2 size-6" />
        Projectをアーカイブしますか？
      </span>
    </template>
    <template #body>
      <p class="mb-3">「{{ project.name }}」を履歴参照専用に変更します。</p>
      <StatusAlert type="warning" variant="soft">
        MVPではアーカイブ解除できません。Project、メンバー、Taskの更新もできなくなります。
      </StatusAlert>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isArchivingProject" @click="closeArchiveConfirm">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isArchivingProject" @click="archiveProject">アーカイブする</UButton>
    </template>
  </UModal>

  <UModal v-model:open="isRemoveConfirmOpen" :dismissible="!isSavingMember" :ui="{ content: 'max-w-140' }">
    <template #title>
      <span class="flex items-center text-error">
        <UIcon name="i-mdi-account-remove-outline" class="me-2 size-6" />
        Projectから除外しますか？
      </span>
    </template>
    <template v-if="memberToRemove" #body>
      <p>アカウントID {{ memberToRemove.accountId }} のmembershipを削除します。</p>
      <StatusAlert v-if="isCurrentMember(memberToRemove)" type="warning" variant="soft" class="mt-3">
        自分を除外すると、このProjectを参照できなくなりProject一覧へ戻ります。
      </StatusAlert>
    </template>
    <template #footer>
      <UButton variant="ghost" :disabled="isSavingMember" @click="closeRemoveConfirm">キャンセル</UButton>
      <UButton color="error" variant="ghost" :loading="isSavingMember" @click="removeMember">除外する</UButton>
    </template>
  </UModal>
</template>
