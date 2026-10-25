import { useRouter } from "vue-router";

import { resolveAuthenticatedHomeRouteName } from "@/app/router/authorization";
import { useUserStore } from "@/features/auth/stores/user";

/**
 * 403・404画面から利用可能な既定画面へ戻る操作を提供する。
 *
 * 認証済みならpermissionに応じた既定画面（`resolveAuthenticatedHomeRouteName`）、未認証ならログイン画面へ遷移する。
 * 遷移先の最終認可はRouter guardとBackendが行う。
 */
export const useHomeNavigation = (): { goHome: () => Promise<void> } => {
  const router = useRouter();
  const userStore = useUserStore();

  const goHome = async (): Promise<void> => {
    const routeName = userStore.isAuthenticated
      ? resolveAuthenticatedHomeRouteName(userStore.permissionCodes)
      : "Login";
    await router.push({ name: routeName });
  };

  return { goHome };
};
