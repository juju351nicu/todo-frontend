<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useProjectListPage } from "@/features/project/composables/useProjectListPage";
import {
  getProjectStatusColor,
  getProjectStatusLabel,
} from "@/features/project/utils/projectStatus";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import SearchField from "@/shared/components/SearchField.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  canCreateProject,
  canSubmitCreate,
  closeCreateDialog,
  createErrorMessages,
  createForm,
  createFormErrors,
  errorMessages,
  filteredProjects,
  initialize,
  isCreateDialogOpen,
  isCreatingProject,
  isLoading,
  openBoard,
  openCreateDialog,
  searchText,
  submitCreate,
} = useProjectListPage();

onBeforeMount(initialize);
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <div class="p-6">
    <UCard class="mx-auto max-w-300">
      <template #header>
        <div class="flex flex-wrap items-center gap-3">
          <UIcon name="i-mdi-view-dashboard-outline" class="size-6" />
          Project一覧
          <SearchField v-model="searchText" label="Projectを検索" class="ms-auto w-80" />
          <!-- Templateを使わずにProjectを作る。Projectがない利用者も最初のProjectを作れる。 -->
          <UButton
            v-if="canCreateProject"
            color="primary"
            icon="i-mdi-folder-plus-outline"
            @click="openCreateDialog"
          >
            Projectを作成
          </UButton>
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>

      <div v-if="filteredProjects.length" class="-m-3 flex flex-wrap">
        <div
          v-for="project in filteredProjects"
          :key="project.projectId"
          class="w-full p-3 md:w-1/2 lg:w-1/3"
        >
          <!-- E2Eはarticle roleとProject keyで対象Projectのcardを特定する。 -->
          <UCard
            as="article"
            variant="outline"
            class="flex h-full flex-col"
            :aria-label="project.name"
          >
            <template #header>
              <div>{{ project.name }}</div>
              <div class="text-sm font-normal tracking-normal text-muted">
                {{ project.projectKey }}
              </div>
            </template>
            <div class="flex flex-wrap gap-2">
              <UBadge :color="getProjectStatusColor(project.status)" size="sm">
                {{ getProjectStatusLabel(project.status) }}
              </UBadge>
              <UBadge v-if="project.projectRole" size="sm" variant="outline">{{
                project.projectRole
              }}</UBadge>
            </div>
            <template #footer>
              <UButton
                color="primary"
                variant="soft"
                icon="i-mdi-view-column-outline"
                class="ms-auto"
                @click="openBoard(project.projectId)"
              >
                Boardを開く
              </UButton>
            </template>
          </UCard>
        </div>
      </div>
      <div v-else-if="!isLoading && !errorMessages.length" class="rounded-sm p-8 text-center">
        <UIcon name="i-mdi-folder-search-outline" class="mb-3 size-12" />
        <h2 class="mb-2 text-xl font-medium">表示できるProjectがありません</h2>
        <p class="mb-0 text-sm text-muted">検索条件またはProjectへの参加状況を確認してください。</p>
      </div>
    </UCard>

    <UModal
      v-model:open="isCreateDialogOpen"
      title="Projectを作成"
      description="作成するとあなたがOWNERになり、Board列（Todo・進行中・完了）が用意されます。"
      :dismissible="!isCreatingProject"
    >
      <template #body>
        <form id="project-create-form" class="space-y-4" @submit.prevent="submitCreate">
          <StatusAlert v-if="createErrorMessages.length" type="error">
            <div v-for="message in createErrorMessages" :key="message">{{ message }}</div>
          </StatusAlert>
          <UFormField
            label="Projectキー"
            required
            help="大文字英数字をハイフンで区切ります（例：SALES-2026）。作成後は変更できません。"
            :error="createFormErrors.projectKey || undefined"
          >
            <UInput
              v-model="createForm.projectKey"
              :disabled="isCreatingProject"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="名前" required :error="createFormErrors.name || undefined">
            <UInput v-model="createForm.name" :disabled="isCreatingProject" class="w-full" />
          </UFormField>
          <UFormField label="説明" :error="createFormErrors.description || undefined">
            <UTextarea
              v-model="createForm.description"
              :rows="3"
              :disabled="isCreatingProject"
              class="w-full"
            />
          </UFormField>
        </form>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" :disabled="isCreatingProject" @click="closeCreateDialog"
            >キャンセル</UButton
          >
          <UButton
            type="submit"
            form="project-create-form"
            color="primary"
            icon="i-mdi-check"
            :loading="isCreatingProject"
            :disabled="!canSubmitCreate"
          >
            作成
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
