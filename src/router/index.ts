import { createRouter, createWebHistory } from "vue-router";

import { routes } from "@/router/routes";
import { useUserStore } from "@/stores/user";

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }
  const userStore = useUserStore();
  if (!(await userStore.restoreSession())) {
    alert("ログインが必要です");
    return { name: "Login" };
  }
  return true;
});

export default router;
