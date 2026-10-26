<script setup lang="ts">
import { useNotificationCenter } from "@/features/notification/composables/useNotificationCenter";
import {
  formatNotificationBadge,
  formatNotificationOccurredAt,
  getNotificationAlertIcon,
  getNotificationEventIcon,
} from "@/features/notification/utils/notification";
import StatusAlert from "@/shared/components/StatusAlert.vue";

const {
  alerts,
  badgeCount,
  errorMessage,
  events,
  handleMenuVisibility,
  hasItems,
  isLoading,
  isMenuOpen,
  loadNotificationCenter,
  navigateToNotification,
  unresolvedAlertCount,
} = useNotificationCenter();
</script>

<template>
  <UPopover
    :open="isMenuOpen"
    :content="{ align: 'end', side: 'bottom', sideOffset: 4 }"
    :ui="{ content: 'rounded-sm shadow-elevation-8 ring-0' }"
    @update:open="handleMenuVisibility"
  >
    <UButton
      variant="ghost"
      square
      size="lg"
      class="size-12 text-white hover:bg-white/4"
      aria-label="通知を開く"
      title="通知"
    >
      <UChip
        :show="badgeCount > 0"
        :text="formatNotificationBadge(badgeCount)"
        size="3xl"
        :ui="{ base: 'h-5 min-w-5 px-1.5 text-xs font-normal text-white bg-error ring-0' }"
      >
        <UIcon name="i-mdi-bell-outline" class="size-6" />
      </UChip>
    </UButton>

    <template #content>
      <div class="max-h-[min(680px,calc(100vh-80px))] w-[min(440px,calc(100vw-24px))] overflow-y-auto bg-default text-default">
        <div class="flex items-center px-4 py-3 text-xl font-medium">
          <UIcon name="i-mdi-bell-outline" class="me-2 size-6" />
          通知
          <UButton
            icon="i-mdi-refresh"
            size="sm"
            variant="ghost"
            square
            class="ms-auto"
            aria-label="通知を再読み込み"
            :loading="isLoading"
            @click="loadNotificationCenter"
          />
        </div>

        <UProgress v-if="isLoading" size="xs" color="secondary" />
        <StatusAlert v-if="errorMessage" type="error" density="compact" class="m-3 w-auto">
          {{ errorMessage }}
        </StatusAlert>

        <div v-if="alerts.length > 0">
          <div class="px-4 pt-2.5 pb-1.5 text-[0.78rem] font-bold tracking-[0.04em] text-muted">
            未解決の警告
            <UBadge color="warning" size="xs" class="ms-2">{{ unresolvedAlertCount }}件</UBadge>
          </div>
          <ul>
            <li v-for="alertItem in alerts" :key="alertItem.alertKey">
              <button
                type="button"
                class="flex w-full gap-8 border-t border-default bg-warning/7 px-4 py-2 text-start hover:bg-warning/12"
                @click="navigateToNotification(alertItem.navigationPath)"
              >
                <UIcon :name="getNotificationAlertIcon(alertItem.alertType)" class="mt-0.5 size-6 shrink-0 text-warning" />
                <span class="min-w-0">
                  <span class="block text-base">{{ alertItem.title }}</span>
                  <span class="line-clamp-2 text-sm text-muted">{{ alertItem.message }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="events.length > 0">
          <div class="px-4 pt-2.5 pb-1.5 text-[0.78rem] font-bold tracking-[0.04em] text-muted">お知らせ・更新</div>
          <ul>
            <li v-for="eventItem in events" :key="eventItem.notificationEventId">
              <button
                type="button"
                class="flex w-full gap-8 border-t border-default px-4 py-2 text-start hover:bg-elevated"
                :class="{ 'bg-primary/6': !eventItem.read }"
                @click="navigateToNotification(eventItem.navigationPath)"
              >
                <UIcon
                  :name="getNotificationEventIcon(eventItem.eventType)"
                  class="mt-0.5 size-6 shrink-0 text-secondary"
                />
                <span class="min-w-0">
                  <span class="flex items-center gap-2 text-base">
                    <span>{{ eventItem.title }}</span>
                    <span v-if="!eventItem.read" class="size-2 shrink-0 rounded-full bg-primary" aria-label="未読" />
                  </span>
                  <span class="line-clamp-2 text-sm text-muted">{{ eventItem.message }}</span>
                  <span class="mt-1 block text-[0.72rem] text-muted">
                    {{ eventItem.publisherDisplayName }}・{{ formatNotificationOccurredAt(eventItem.occurredAt) }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!isLoading && !hasItems" class="px-4 py-8 text-center text-sm text-muted">
          <UIcon name="i-mdi-bell-check-outline" class="mb-2 size-9" />
          <div>新しい通知はありません。</div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
