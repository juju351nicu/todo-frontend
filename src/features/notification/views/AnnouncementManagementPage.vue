<script setup lang="ts">
import AppHeader from "@/app/layouts/AppHeader.vue";
import {
  ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAnnouncementManagementPage,
} from "@/features/notification/composables/useAnnouncementManagementPage";

const {
  canSubmit,
  errorMessages,
  expiresAtLocal,
  isSubmitting,
  message,
  submitAnnouncement,
  successMessage,
  title,
} = useAnnouncementManagementPage();
</script>

<template>
  <AppHeader />
  <v-container fluid class="announcement-page pa-4 pa-sm-6">
    <v-card class="mx-auto" max-width="900" elevation="2">
      <v-card-title class="d-flex align-center flex-wrap ga-3 px-6 pt-6">
        <v-avatar color="deep-purple-lighten-5" size="48">
          <v-icon icon="mdi-bullhorn-outline" color="deep-purple" />
        </v-avatar>
        <div>
          <div class="text-h5">お知らせ配信</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            全利用者のヘッダーにあるベルへお知らせを配信します。
          </div>
        </div>
      </v-card-title>

      <v-card-text class="pa-6">
        <v-alert type="info" variant="tonal" class="mb-5">
          Task割当と勤怠差戻しは業務操作に連動して自動通知されます。この画面では管理者からの全体お知らせだけを作成します。
        </v-alert>
        <v-alert v-if="successMessage" type="success" class="mb-5">
          {{ successMessage }}
        </v-alert>
        <v-alert v-if="errorMessages.length" type="error" class="mb-5">
          <div v-for="errorMessage in errorMessages" :key="errorMessage">
            {{ errorMessage }}
          </div>
        </v-alert>

        <v-form @submit.prevent="submitAnnouncement">
          <v-text-field
            v-model="title"
            label="件名"
            variant="outlined"
            :maxlength="ANNOUNCEMENT_TITLE_MAX_LENGTH"
            counter
            required
            :disabled="isSubmitting"
          />
          <v-textarea
            v-model="message"
            label="本文"
            variant="outlined"
            rows="8"
            auto-grow
            :maxlength="ANNOUNCEMENT_MESSAGE_MAX_LENGTH"
            counter
            required
            :disabled="isSubmitting"
          />
          <v-text-field
            v-model="expiresAtLocal"
            label="表示終了日時（任意）"
            type="datetime-local"
            variant="outlined"
            persistent-hint
            hint="未入力の場合は無期限で表示します。"
            :disabled="isSubmitting"
          />

          <div class="d-flex justify-end mt-6">
            <v-btn
              type="submit"
              color="deep-purple"
              size="large"
              prepend-icon="mdi-send"
              :disabled="!canSubmit"
              :loading="isSubmitting"
            >
              全利用者へ配信
            </v-btn>
          </div>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
.announcement-page {
  min-height: calc(100vh - 64px);
  background: rgb(var(--v-theme-surface-variant));
}
</style>
