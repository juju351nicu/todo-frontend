import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user";
import { routes } from "@/router/routes.js";

const router = createRouter({
  // Viteの環境変数でimport.meta.env.BASE_URL = vite.config.tsのbase
  history: createWebHistory(),
  routes,
});
/**
 * ナビゲーションガード
 */
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
