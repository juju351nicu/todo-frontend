<script setup lang="ts">
import { onBeforeMount } from "vue";

import { useProjectListPage } from "@/features/project/composables/useProjectListPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import SearchField from "@/shared/components/SearchField.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const { errorMessages, filteredProjects, initialize, isLoading, openBoard, searchText } = useProjectListPage();

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
        </div>
      </template>

      <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
        <div v-for="message in errorMessages" :key="message">{{ message }}</div>
      </StatusAlert>

      <div v-if="filteredProjects.length" class="-m-3 flex flex-wrap">
        <div v-for="project in filteredProjects" :key="project.projectId" class="w-full p-3 md:w-1/2 lg:w-1/3">
          <!-- E2Eはarticle roleとProject keyで対象Projectのcardを特定する。 -->
          <UCard as="article" variant="outline" class="flex h-full flex-col" :aria-label="project.name">
            <template #header>
              <div>{{ project.name }}</div>
              <div class="text-sm font-normal tracking-normal text-muted">{{ project.projectKey }}</div>
            </template>
            <div class="flex flex-wrap gap-2">
              <UBadge :color="project.status === 'ACTIVE' ? 'success' : 'neutral'" size="sm">
                {{ project.status === "ACTIVE" ? "利用中" : "アーカイブ" }}
              </UBadge>
              <UBadge v-if="project.projectRole" size="sm" variant="outline">{{ project.projectRole }}</UBadge>
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
  </div>
</template>
