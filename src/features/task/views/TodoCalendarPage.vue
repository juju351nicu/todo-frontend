<script setup lang="ts">
import AppHeader from "@/app/layouts/AppHeader.vue";
import LoadingIndicator from "@/shared/components/LoadingIndicator.vue";
import FullCalendar from "@fullcalendar/vue3";
import { onBeforeMount } from "vue";

import { useTodoCalendarPage } from "@/features/task/composables/useTodoCalendarPage";

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
  <AppHeader />
  <LoadingIndicator v-if="isLoading" />
  <v-alert v-if="errorMessages.length" type="error" class="mb-4">
    <div v-for="message in errorMessages" :key="message">{{ message }}</div>
  </v-alert>
  <v-card class="mx-auto" max-width="1000">
    <v-card-item>
      <v-card-title>
        Todo検索
        <v-row>
          <v-col>
            <v-text-field v-model="searchTitle" color="purple darken-2" placeholder="タイトル">
            </v-text-field>
          </v-col>
          <!--  <v-col>
                        <input type="text" name="date_from" placeholder="日付(date_from)" />
                        <input type="text" name="date_to" placeholder="日付(date_to)" />
                    </v-col> -->
          <v-col>
            <v-checkbox v-model="selectedDoneFlag" value="0" label="未完了のみ">
            </v-checkbox>
          </v-col>
          <v-col>
            <v-checkbox v-model="selectedDoneFlag" value="1" label="完了のみ">
            </v-checkbox>
          </v-col>
        </v-row>
      </v-card-title>
      <v-card-subtitle style="text-align: right">
        11月8日
      </v-card-subtitle>
    </v-card-item>
    <v-card-text style="text-align: right">
      <v-btn color="success" @click="search">検索</v-btn>
    </v-card-text>
  </v-card>
  <br />
  <FullCalendar :options="calendarOptions" />
</template>
<style>
th.fc-day-sat {
  background-color: #eaf4ff;
  /* 土曜日は青色に */
}

th.fc-day-sun {
  background-color: #ffeaea;
  /* 日曜日は赤色に */
}

td.fc-day-sat {
  background-color: #eaf4ff;
  /* 土曜日は青色に */
}

td.fc-day-sun {
  background-color: #ffeaea;
  /* 日曜日は赤色に */
}
</style>
