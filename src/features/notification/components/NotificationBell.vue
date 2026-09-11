<script setup lang="ts">
import { useNotificationCenter } from "@/features/notification/composables/useNotificationCenter";
import {
  formatNotificationBadge,
  formatNotificationOccurredAt,
  getNotificationAlertIcon,
  getNotificationEventIcon,
} from "@/features/notification/utils/notification";

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
  <v-menu
    :model-value="isMenuOpen"
    :close-on-content-click="false"
    location="bottom end"
    @update:model-value="handleMenuVisibility"
  >
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        icon
        variant="text"
        aria-label="通知を開く"
        title="通知"
      >
        <v-badge
          :model-value="badgeCount > 0"
          :content="formatNotificationBadge(badgeCount)"
          color="red-accent-2"
        >
          <v-icon icon="mdi-bell-outline" />
        </v-badge>
      </v-btn>
    </template>

    <v-card class="notification-card" elevation="8">
      <v-card-title class="d-flex align-center py-3">
        <v-icon icon="mdi-bell-outline" class="mr-2" />
        通知
        <v-spacer />
        <v-btn
          icon="mdi-refresh"
          size="small"
          variant="text"
          aria-label="通知を再読み込み"
          :loading="isLoading"
          @click="loadNotificationCenter"
        />
      </v-card-title>

      <v-progress-linear v-if="isLoading" indeterminate color="deep-purple" />
      <v-alert v-if="errorMessage" type="error" density="compact" class="ma-3">
        {{ errorMessage }}
      </v-alert>

      <div v-if="alerts.length > 0">
        <div class="notification-section-title">
          未解決の警告
          <v-chip color="warning" size="x-small" class="ml-2">
            {{ unresolvedAlertCount }}件
          </v-chip>
        </div>
        <v-list lines="three" density="compact">
          <v-list-item
            v-for="alertItem in alerts"
            :key="alertItem.alertKey"
            class="notification-item notification-alert"
            @click="navigateToNotification(alertItem.navigationPath)"
          >
            <template #prepend>
              <v-icon
                :icon="getNotificationAlertIcon(alertItem.alertType)"
                color="warning"
              />
            </template>
            <v-list-item-title>{{ alertItem.title }}</v-list-item-title>
            <v-list-item-subtitle>{{ alertItem.message }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>

      <div v-if="events.length > 0">
        <div class="notification-section-title">お知らせ・更新</div>
        <v-list lines="three" density="compact">
          <v-list-item
            v-for="eventItem in events"
            :key="eventItem.notificationEventId"
            class="notification-item"
            :class="{ 'notification-unread': !eventItem.read }"
            @click="navigateToNotification(eventItem.navigationPath)"
          >
            <template #prepend>
              <v-icon
                :icon="getNotificationEventIcon(eventItem.eventType)"
                color="deep-purple"
              />
            </template>
            <v-list-item-title class="d-flex align-center ga-2">
              <span>{{ eventItem.title }}</span>
              <span v-if="!eventItem.read" class="unread-dot" aria-label="未読" />
            </v-list-item-title>
            <v-list-item-subtitle>{{ eventItem.message }}</v-list-item-subtitle>
            <v-list-item-subtitle class="notification-meta">
              {{ eventItem.publisherDisplayName }}・{{
                formatNotificationOccurredAt(eventItem.occurredAt)
              }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </div>

      <v-card-text v-if="!isLoading && !hasItems" class="text-center text-medium-emphasis py-8">
        <v-icon icon="mdi-bell-check-outline" size="36" class="mb-2" />
        <div>新しい通知はありません。</div>
      </v-card-text>
    </v-card>
  </v-menu>
</template>

<style scoped>
.notification-card {
  width: min(440px, calc(100vw - 24px));
  max-height: min(680px, calc(100vh - 80px));
  overflow-y: auto;
}

.notification-section-title {
  padding: 10px 16px 6px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.notification-item {
  cursor: pointer;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.notification-alert {
  background: rgba(var(--v-theme-warning), 0.07);
}

.notification-unread {
  background: rgba(var(--v-theme-primary), 0.06);
}

.notification-meta {
  margin-top: 4px;
  font-size: 0.72rem;
}

.unread-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
}
</style>
