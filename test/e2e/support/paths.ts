import { resolve } from "node:path";

/** Dashboard専用accountのSession Cookieを保存するGit管理外path。 */
export const DASHBOARD_AUTH_STATE_PATH = resolve(
  "playwright/.auth/dashboard-browser.json"
);

/** My Tasks主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const MY_TASKS_AUTH_STATE_PATH = resolve(
  "playwright/.auth/my-tasks-browser.json"
);

/** Board主要journey専用accountのSession Cookieを保存するGit管理外path。 */
export const BOARD_AUTH_STATE_PATH = resolve(
  "playwright/.auth/board-browser.json"
);

/** setupとteardownで同時に管理する全認証状態path。 */
export const AUTH_STATE_PATHS = [
  DASHBOARD_AUTH_STATE_PATH,
  MY_TASKS_AUTH_STATE_PATH,
  BOARD_AUTH_STATE_PATH,
] as const;

/** Playwrightから参照するBackend repositoryのpath。CIではcheckout先を環境変数で指定する。 */
export const BACKEND_PATH = resolve(
  process.env.E2E_BACKEND_PATH ?? "../todo-backend"
);
