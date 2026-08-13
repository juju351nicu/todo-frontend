import { createRouter, createWebHistory } from "vue-router";

import { hasAnyPermission } from "@/app/router/authorization";
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
    alert("ログインが必要です");
    return { name: "Login" };
  }
  if (!hasAnyPermission(userStore.permissionCodes, requiredPermissions)) {
    return { name: "AccessDenied" };
  }
  return true;
});

export default router;
