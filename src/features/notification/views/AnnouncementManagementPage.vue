<script setup lang="ts">
import {
  ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  useAnnouncementManagementPage,
} from "@/features/notification/composables/useAnnouncementManagementPage";
import FieldCounter from "@/shared/components/FieldCounter.vue";
import StatusAlert from "@/shared/components/StatusAlert.vue";

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
  <div class="page-surface p-4 sm:p-6">
    <UCard class="mx-auto max-w-225 shadow-elevation-2" :ui="{ body: 'p-6 sm:p-6' }">
      <template #header>
        <div class="flex flex-wrap items-center gap-3 px-2 pt-4">
          <UAvatar icon="i-mdi-bullhorn-outline" size="3xl" class="bg-secondary/12 text-secondary" />
          <div>
            <div class="text-2xl font-normal">お知らせ配信</div>
            <div class="mt-1 text-sm font-normal tracking-normal text-muted">
              全利用者のヘッダーにあるベルへお知らせを配信します。
            </div>
          </div>
        </div>
      </template>

      <StatusAlert type="info" variant="soft" class="mb-5">
        Task割当と勤怠差戻しは業務操作に連動して自動通知されます。この画面では管理者からの全体お知らせだけを作成します。
      </StatusAlert>
      <StatusAlert v-if="successMessage" type="success" class="mb-5">
        {{ successMessage }}
      </StatusAlert>
      <StatusAlert v-if="errorMessages.length" type="error" class="mb-5">
        <div v-for="errorMessage in errorMessages" :key="errorMessage">
          {{ errorMessage }}
        </div>
      </StatusAlert>

      <form @submit.prevent="submitAnnouncement">
        <div class="relative">
          <UFormField label="件名">
            <UInput
              v-model="title"
              variant="outline"
              :maxlength="ANNOUNCEMENT_TITLE_MAX_LENGTH"
              required
              :disabled="isSubmitting"
              class="w-full"
            />
          </UFormField>
          <FieldCounter :value="title" :max="ANNOUNCEMENT_TITLE_MAX_LENGTH" />
        </div>
        <div class="relative">
          <UFormField label="本文">
            <UTextarea
              v-model="message"
              variant="outline"
              :rows="8"
              autoresize
              :maxlength="ANNOUNCEMENT_MESSAGE_MAX_LENGTH"
              required
              :disabled="isSubmitting"
              class="w-full"
            />
          </UFormField>
          <FieldCounter :value="message" :max="ANNOUNCEMENT_MESSAGE_MAX_LENGTH" />
        </div>
        <UFormField label="表示終了日時（任意）" help="未入力の場合は無期限で表示します。">
          <UInput v-model="expiresAtLocal" type="datetime-local" variant="outline" :disabled="isSubmitting" class="w-full" />
        </UFormField>

        <div class="mt-6 flex justify-end">
          <UButton
            type="submit"
            color="primary"
            size="lg"
            icon="i-mdi-send"
            :disabled="!canSubmit"
            :loading="isSubmitting"
          >
            全利用者へ配信
          </UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
