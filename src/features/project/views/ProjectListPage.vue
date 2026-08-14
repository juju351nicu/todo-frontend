<script setup lang="ts">
import { onBeforeMount } from "vue";

import AppHeader from "@/app/layouts/AppHeader.vue";
import { useProjectListPage } from "@/features/project/composables/useProjectListPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";

const {
  errorMessages,
  filteredProjects,
  initialize,
  isLoading,
  openBoard,
  searchText,
} = useProjectListPage();

onBeforeMount(initialize);
</script>

<template>
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-container fluid class="pa-6">
    <v-card class="mx-auto" max-width="1200">
      <v-card-title class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-view-dashboard-outline" />
        Project一覧
        <v-spacer />
        <v-text-field
          v-model="searchText"
          label="Projectを検索"
          prepend-inner-icon="mdi-magnify"
          clearable
          density="compact"
          hide-details
          max-width="320"
        />
      </v-card-title>

      <v-card-text>
        <v-alert v-if="errorMessages.length" type="error" class="mb-4">
          <div v-for="message in errorMessages" :key="message">{{ message }}</div>
        </v-alert>

        <v-row v-if="filteredProjects.length">
          <v-col
            v-for="project in filteredProjects"
            :key="project.projectId"
            cols="12"
            md="6"
            lg="4"
          >
            <v-card variant="outlined" height="100%">
              <v-card-title>{{ project.name }}</v-card-title>
              <v-card-subtitle>{{ project.projectKey }}</v-card-subtitle>
              <v-card-text class="d-flex ga-2 flex-wrap">
                <v-chip
                  :color="project.status === 'ACTIVE' ? 'success' : 'default'"
                  size="small"
                >
                  {{ project.status === "ACTIVE" ? "利用中" : "アーカイブ" }}
                </v-chip>
                <v-chip v-if="project.projectRole" size="small" variant="outlined">
                  {{ project.projectRole }}
                </v-chip>
              </v-card-text>
              <v-card-actions>
                <v-spacer />
                <v-btn
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-view-column-outline"
                  @click="openBoard(project.projectId)"
                >
                  Boardを開く
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
        <v-sheet
          v-else-if="!isLoading && !errorMessages.length"
          class="pa-8 text-center"
          rounded
        >
          <v-icon icon="mdi-folder-search-outline" size="48" class="mb-3" />
          <h2 class="text-h6 mb-2">表示できるProjectがありません</h2>
          <p class="text-body-2 text-medium-emphasis mb-0">
            検索条件またはProjectへの参加状況を確認してください。
          </p>
        </v-sheet>
      </v-card-text>
    </v-card>
  </v-container>
</template>
