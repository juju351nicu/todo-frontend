import { resolve } from "node:path";

/** Session Cookieを含む認証状態を、Git管理外の一時fileへ保存するpath。 */
export const AUTH_STATE_PATH = resolve(
  "playwright/.auth/dashboard-browser.json"
);

/** Playwrightから参照するBackend repositoryのpath。CIではcheckout先を環境変数で指定する。 */
export const BACKEND_PATH = resolve(
  process.env.E2E_BACKEND_PATH ?? "../todo-backend"
);
