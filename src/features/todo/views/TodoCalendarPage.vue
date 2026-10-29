<script setup lang="ts">
import FullCalendar from "@fullcalendar/vue3";
import { onBeforeMount } from "vue";

import TodoSearchCard from "@/features/todo/components/TodoSearchCard.vue";
import { useTodoCalendarPage } from "@/features/todo/composables/useTodoCalendarPage";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  calendarOptions,
  errorMessages,
  initialize,
  isLoading,
  search,
  searchTitle,
  selectedDoneFlag,
} = useTodoCalendarPage();

onBeforeMount(() => {
  void initialize();
});
</script>

<template>
  <LoadingIndicator v-if="isLoading" />
  <StatusAlert v-if="errorMessages.length" type="error" class="mb-4">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </StatusAlert>
  <TodoSearchCard
    v-model:search-title="searchTitle"
    v-model:selected-done-flag="selectedDoneFlag"
    @search="search"
  />
  <br />
  <FullCalendar :options="calendarOptions" />
</template>

<style>
/* FullCalendarが生成する曜日セルは外部DOMのため、scopedにせず土曜を青、日曜を赤の背景にする。 */
th.fc-day-sat,
td.fc-day-sat {
  background-color: #eaf4ff;
}

th.fc-day-sun,
td.fc-day-sun {
  background-color: #ffeaea;
}
</style>
