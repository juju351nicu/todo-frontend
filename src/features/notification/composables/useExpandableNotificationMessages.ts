import { ref } from "vue";

import { normalizeNotificationNavigationPath } from "@/features/notification/utils/notification";

/** 本文の開閉を判定するために必要な通知の項目。ベルとDashboardの両方の通知型が満たす。 */
export interface ExpandableNotification {
  /** 通知のID。開閉状態の識別に使う。 */
  notificationEventId: number;
  /** 通知を押したときの遷移先。管理者お知らせなど遷移先がない通知はnull。 */
  navigationPath: string | null | undefined;
}

/**
 * 通知一覧で、遷移先のない通知（管理者お知らせなど）の本文を開閉する状態を管理する。
 *
 * 一覧では本文を2行に切り詰めて表示するが、管理者お知らせは最大2000文字・複数行になりうる。
 * 遷移先がないため押しても何も起きず、3行目以降を読む手段がなかったので、押したら全文を開くようにする。
 * 遷移先のある通知（Task割当など）は従来どおり遷移し、開閉の対象にしない。
 *
 * 開閉状態は画面の一時状態で、通知の再取得では消さない（読んでいる途中で閉じないため）。
 *
 * @returns 開閉の判定・切替と、通知を押したときの共通処理
 */
export const useExpandableNotificationMessages = () => {
  /** 本文を全文表示している通知のID。 */
  const expandedNotificationIds = ref<Set<number>>(new Set());

  /**
   * 通知が本文の開閉対象か判定する。遷移先のない通知だけが対象。
   *
   * @param notification 判定する通知
   * @returns 開閉できる場合はtrue
   */
  const canExpandNotification = (notification: ExpandableNotification): boolean =>
    normalizeNotificationNavigationPath(notification.navigationPath) === null;

  /**
   * 通知の本文を全文表示しているか。
   *
   * @param notificationEventId 通知のID
   * @returns 全文表示中ならtrue
   */
  const isNotificationExpanded = (notificationEventId: number): boolean =>
    expandedNotificationIds.value.has(notificationEventId);

  /**
   * 通知の本文の全文表示を切り替える。Setを作り直し、Vueの再描画を確実にする。
   *
   * @param notificationEventId 通知のID
   */
  const toggleNotificationExpanded = (notificationEventId: number): void => {
    const next = new Set(expandedNotificationIds.value);
    if (next.has(notificationEventId)) {
      next.delete(notificationEventId);
    } else {
      next.add(notificationEventId);
    }
    expandedNotificationIds.value = next;
  };

  /**
   * 通知を押したときの共通処理。遷移先があれば遷移を、なければ本文の開閉を行う。
   *
   * @param notification 押された通知
   * @param navigate 遷移先がある場合に呼ぶ遷移処理（呼び出し元の画面ごとに異なる）
   */
  const openOrToggleNotification = async (
    notification: ExpandableNotification,
    navigate: (navigationPath: string) => Promise<void>,
  ): Promise<void> => {
    const navigationPath = normalizeNotificationNavigationPath(notification.navigationPath);
    if (navigationPath === null) {
      toggleNotificationExpanded(notification.notificationEventId);
      return;
    }
    await navigate(navigationPath);
  };

  return {
    canExpandNotification,
    isNotificationExpanded,
    openOrToggleNotification,
    toggleNotificationExpanded,
  };
};
