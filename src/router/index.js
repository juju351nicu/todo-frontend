import { createRouter, createWebHistory } from "vue-router";
import { useUserStore } from "@/stores/user";
import Util from "@/utils/util.js";
import { routes } from "@/router/routes.js";

const router = createRouter({
  // Viteの環境変数でimport.meta.env.BASE_URL = vite.config.tsのbase
  history: createWebHistory(),
  routes,
});
/**
 * ストアにトークン情報がある場合、true。ない場合、false。
 * @returns 判定結果
 */
const isAuthorited = () => {
  // Authストア情報
  const userStore = useUserStore();
  const token = userStore.getAccessToken;
  return !Util.isEmpty(token);
};
/**
 * ナビゲーションガード
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth && !isAuthorited()) {
    alert("ログインが必要です");
    next("/"); // 未認証ならログインページへ
  } else {
    next();
  }
});
export default router;
