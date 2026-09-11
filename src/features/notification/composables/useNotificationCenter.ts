import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useUserStore } from "@/features/auth/stores/user";
import NotificationApi, {
  NotificationApiError,
} from "@/features/notification/api/notificationApi";
import type {
  NotificationAlert,
  NotificationEvent,
} from "@/features/notification/types/notification";
import { normalizeNotificationNavigationPath } from "@/features/notification/utils/notification";

/** 別画面で通知発生操作を完了したとき、ベルの明示的再読込を依頼するbrowser event名。 */
export const NOTIFICATION_REFRESH_EVENT = "notification-center-refresh";

/**
 * ヘッダーのベル通知を取得し、イベント既読と通知先画面への遷移を管理する。
 * 定期pollingはHttpSessionの無操作期限を不自然に延長するため行わず、初期表示・画面復帰・
 * route変更・業務操作後の明示eventだけで再取得する。
 */
export const useNotificationCenter = () => {
  const route = useRoute();
  const router = useRouter();
  const userStore = useUserStore();

  const alerts = ref<NotificationAlert[]>([]);
  const badgeCount = ref(0);
  const errorMessage = ref("");
  const events = ref<NotificationEvent[]>([]);
  const isLoading = ref(false);
  const isMenuOpen = ref(false);
  const unreadEventCount = ref(0);
  const unresolvedAlertCount = ref(0);
  const hasItems = computed(() => alerts.value.length > 0 || events.value.length > 0);

  /** Backendから通知スナップショットを取得し、前回表示値を原子的に置き換える。 */
  const loadNotificationCenter = async (): Promise<void> => {
    if (isLoading.value || !userStore.isAuthenticated) {
      return;
    }
    isLoading.value = true;
    errorMessage.value = "";
    try {
      const response = await NotificationApi.getNotificationCenter();
      alerts.value = response.alerts ?? [];
      events.value = response.events ?? [];
      unreadEventCount.value = response.unreadEventCount;
      unresolvedAlertCount.value = response.unresolvedAlertCount;
      badgeCount.value = response.badgeCount;
    } catch (error: unknown) {
      await handleApiError(error, "通知を取得できませんでした。");
    } finally {
      isLoading.value = false;
    }
  };

  /** メニューを開いた利用者が一覧を視認できた後、保存型イベントだけを一括既読にする。 */
  const markEventsRead = async (): Promise<void> => {
    if (unreadEventCount.value === 0) {
      return;
    }
    try {
      await NotificationApi.markEventsRead();
      events.value = events.value.map((event) => ({ ...event, read: true }));
      badgeCount.value = Math.max(0, badgeCount.value - unreadEventCount.value);
      unreadEventCount.value = 0;
    } catch (error: unknown) {
      await handleApiError(error, "通知を既読にできませんでした。");
    }
  };

  /** Vuetify menuの開閉を反映し、開いた時だけ最新状態の取得と既読更新を行う。 */
  const handleMenuVisibility = async (visible: boolean): Promise<void> => {
    isMenuOpen.value = visible;
    if (!visible) {
      return;
    }
    await loadNotificationCenter();
    await nextTick();
    await markEventsRead();
  };

  /** 通知の遷移先がFrontend内pathの場合だけメニューを閉じて移動する。 */
  const navigateToNotification = async (
    navigationPath: string | null | undefined
  ): Promise<void> => {
    const path = normalizeNotificationNavigationPath(navigationPath);
    if (!path) {
      return;
    }
    isMenuOpen.value = false;
    await router.push(path);
  };

  /** Windowへfocusが戻った時点で、別タブの操作結果を通知へ反映する。 */
  const handleWindowFocus = (): void => {
    void loadNotificationCenter();
  };

  /** 非表示tabが再表示された場合だけ再取得し、background通信は発生させない。 */
  const handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible") {
      void loadNotificationCenter();
    }
  };

  /** 401はSession表示を破棄してログインへ戻し、それ以外はベル内メッセージへ変換する。 */
  const handleApiError = async (
    error: unknown,
    fallbackMessage: string
  ): Promise<void> => {
    if (error instanceof NotificationApiError && error.status === 401) {
      userStore.clearSession();
      await router.push({ name: "Login" });
      return;
    }
    errorMessage.value = fallbackMessage;
  };

  onMounted(() => {
    void loadNotificationCenter();
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener(NOTIFICATION_REFRESH_EVENT, handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("focus", handleWindowFocus);
    window.removeEventListener(NOTIFICATION_REFRESH_EVENT, handleWindowFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  watch(
    () => route.fullPath,
    () => void loadNotificationCenter()
  );

  return {
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
    unreadEventCount,
    unresolvedAlertCount,
  };
};
