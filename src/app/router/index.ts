import { createRouter, createWebHistory } from "vue-router";

import { hasAnyPermission, LOGIN_REQUIRED_QUERY } from "@/app/router/authorization";
import { ROUTE_NAMES } from "@/app/router/routeNames";
import { routes } from "@/app/router/routes";
import { useUserStore } from "@/features/auth/stores/user";

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const requiredPermissions = to.meta.requiredAnyPermissions ?? [];
  if (!to.meta.requiresAuth && requiredPermissions.length === 0) {
    return true;
  }
  const userStore = useUserStore();
  if (!(await userStore.restoreSession())) {
    // ブラウザーのalertは操作を止め、閉じると内容が残らないため、理由をqueryで渡してLogin画面内に表示する。
    return { name: ROUTE_NAMES.login, query: LOGIN_REQUIRED_QUERY };
  }
  if (!hasAnyPermission(userStore.permissionCodes, requiredPermissions)) {
    return { name: ROUTE_NAMES.accessDenied };
  }
  return true;
});

export default router;
