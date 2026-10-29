import { computed, ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useUserStore } from "@/features/auth/stores/user";
import {
  ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES,
  ATTENDANCE_READ_PERMISSION_CODES,
  TASK_READ_PERMISSION_CODES,
  TASK_WRITE_PERMISSION_CODES,
} from "@/features/auth/types/auth";

/** サイドメニューの1項目。 */
export interface NavigationLink {
  /** Nuxt UIの`UIcon`へ渡すIconify名（`i-mdi-*`）。 */
  icon: string;
  /** 表示名。同じURLの項目があるため、一覧のkeyにも使用する。 */
  label: string;
  /** Frontend内の絶対path。 */
  to: string;
}

/** `useAppNavigation`が返すアプリ共通レイアウトの状態と操作。 */
export interface AppNavigation {
  /** サイドメニューを開いている場合はtrue。初期値は閉。 */
  isDrawerOpen: Ref<boolean>;
  /** 現在のSession利用者のrole・permissionで表示できるメニュー項目。表示順は配列順。 */
  navigationLinks: ComputedRef<NavigationLink[]>;
  /** サイドメニューの開閉を切り替える。 */
  toggleDrawer: () => void;
  /** ログアウトAPIを呼び、成否にかかわらずサイドメニューを閉じてログイン画面へ遷移する。 */
  logout: () => Promise<void>;
}

/**
 * アプリ共通レイアウト（ヘッダー・サイドメニュー）の状態と操作を提供する。
 *
 * メニュー項目はuser storeのrole・permissionから算出する。表示制御は画面の補助であり、
 * 各APIの最終認可はBackendが行う。route単位の認可は`src/app/router/authorization.ts`が担当する。
 */
export const useAppNavigation = (): AppNavigation => {
  const router = useRouter();
  const userStore = useUserStore();
  const isDrawerOpen = ref<boolean>(false);

  const navigationLinks = computed<NavigationLink[]>(() => {
    const links: NavigationLink[] = [{ icon: "i-mdi-view-dashboard", label: "Dashboard", to: "/dashboard" }];
    if (userStore.hasAnyPermission(TASK_READ_PERMISSION_CODES)) {
      links.push(
        { icon: "i-mdi-calendar", label: "Todoカレンダー", to: "/todo/calendar" },
        { icon: "i-mdi-format-list-checks", label: "Todo一覧", to: "/todo/todoList" },
      );
    }
    if (userStore.hasPermission("TASK_READ")) {
      links.push(
        { icon: "i-mdi-format-list-checks", label: "My Tasks", to: "/my-tasks" },
        { icon: "i-mdi-magnify", label: "Task検索", to: "/tasks/search" },
      );
    }
    if (userStore.hasPermission("PROJECT_READ")) {
      links.push(
        { icon: "i-mdi-view-dashboard-outline", label: "Project Board", to: "/projects" },
        { icon: "i-mdi-folder-multiple-outline", label: "Project Template", to: "/project-templates" },
      );
    }
    if (userStore.hasAnyPermission(ATTENDANCE_ADMINISTRATION_READ_PERMISSION_CODES)) {
      links.push({ icon: "i-mdi-calendar-account-outline", label: "勤怠月次確認", to: "/attendance/administration" });
    }
    if (userStore.hasAnyPermission(ATTENDANCE_READ_PERMISSION_CODES)) {
      links.push({ icon: "i-mdi-clock-outline", label: "勤怠", to: "/attendance" });
    }
    // 未認証でも共通レイアウトを表示する画面（問い合わせ）があるため、利用者IDがない場合は本人向けの導線を出さない。
    // 「アカウント」は自分の会員情報（詳細画面）を開く。会員の一覧は、ACCOUNT_READを持つ管理者だけが「会員一覧」から開く
    // （同じ一覧画面へのリンクが2つ並んでいたため。確認依頼「会員一覧の見え方の変更」3、2026-10-28決定）。
    if (userStore.memberId !== null) {
      links.push(
        { icon: "i-mdi-account", label: "アカウント", to: `/member/detail/${userStore.memberId}` },
        { icon: "i-mdi-account-cancel", label: "退会", to: `/member/cancel/${userStore.memberId}` },
      );
    }
    if (userStore.hasAnyPermission(TASK_WRITE_PERMISSION_CODES)) {
      links.push({ icon: "i-mdi-plus-box", label: "Todo新規登録", to: "/todo/register" });
    }
    if (userStore.hasPermission("ACCOUNT_READ")) {
      links.push({ icon: "i-mdi-account-key", label: "アカウント・ロール管理", to: "/administration/accounts" });
    }
    if (userStore.hasPermission("AUTHORIZATION_AUDIT_READ")) {
      links.push({ icon: "i-mdi-history", label: "権限変更監査ログ", to: "/administration/authorization-audit-logs" });
    }
    if (userStore.hasPermission("NOTIFICATION_ANNOUNCEMENT_CREATE")) {
      links.push({ icon: "i-mdi-bullhorn-outline", label: "お知らせ配信", to: "/administration/notifications" });
    }
    // 会員の登録・一覧はBackend（MemberAccessLogic）と同じpermissionで出し分ける。ロール名では判定しない。
    if (userStore.hasPermission("ACCOUNT_UPDATE")) {
      links.push({ icon: "i-mdi-account-plus", label: "会員新規登録", to: "/member/detail" });
    }
    if (userStore.hasPermission("ACCOUNT_READ")) {
      links.push({ icon: "i-mdi-account-multiple", label: "会員一覧", to: "/member/memberList" });
    }
    return links;
  });

  const toggleDrawer = (): void => {
    isDrawerOpen.value = !isDrawerOpen.value;
  };

  const logout = async (): Promise<void> => {
    try {
      await userStore.logout();
    } catch (_error: unknown) {
      // Logout APIが失敗しても、端末上の認証表示を残さずログイン画面へ戻す。
    } finally {
      isDrawerOpen.value = false;
      await router.push({ name: ROUTE_NAMES.login });
    }
  };

  return { isDrawerOpen, navigationLinks, toggleDrawer, logout };
};
