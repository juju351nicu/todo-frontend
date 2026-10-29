import { useRouter } from "vue-router";

import { AUTHENTICATED_HOME_ROUTE_NAME } from "@/app/router/authorization";
import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useUserStore } from "@/features/auth/stores/user";

/**
 * 403・404画面から利用可能な既定画面へ戻る操作を提供する。
 *
 * 認証済みならpermissionに応じた既定画面（`AUTHENTICATED_HOME_ROUTE_NAME`）、未認証ならログイン画面へ遷移する。
 * 遷移先の最終認可はRouter guardとBackendが行う。
 */
export const useHomeNavigation = (): { goHome: () => Promise<void> } => {
  const router = useRouter();
  const userStore = useUserStore();

  const goHome = async (): Promise<void> => {
    const routeName = userStore.isAuthenticated ? AUTHENTICATED_HOME_ROUTE_NAME : ROUTE_NAMES.login;
    await router.push({ name: routeName });
  };

  return { goHome };
};
