import { expect, test as setup, type Page } from "@playwright/test";

import {
  BOARD_AUTH_STATE_PATH,
  DASHBOARD_AUTH_STATE_PATH,
  MY_TASKS_AUTH_STATE_PATH,
} from "./support/paths";

const BOARD_LOGIN_ID = process.env.E2E_BOARD_LOGIN_ID ?? "board-browser";
const DASHBOARD_LOGIN_ID = process.env.E2E_LOGIN_ID ?? "dashboard-browser";
const MY_TASKS_LOGIN_ID =
  process.env.E2E_MY_TASKS_LOGIN_ID ?? "my-tasks-browser";
const PASSWORD = process.env.E2E_PASSWORD ?? "password";

/** 専用accountでログインし、Session Cookieを指定されたGit管理外fileへ保存する。 */
const authenticate = async (
  page: Page,
  loginId: string,
  authStatePath: string
): Promise<void> => {
  await page.goto("/");
  await page.getByPlaceholder("ログインID").fill(loginId);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Dashboard$/ })).toBeVisible();

  // storageStateはSession Cookieを含むため、Git管理外fileへだけ保存しartifactへ添付しない。
  await page.context().storageState({ path: authStatePath });
};

setup("Dashboard専用accountで認証状態を準備する", async ({ page }) => {
  await authenticate(page, DASHBOARD_LOGIN_ID, DASHBOARD_AUTH_STATE_PATH);
});

setup("My Tasks専用accountで認証状態を準備する", async ({ page }) => {
  await authenticate(page, MY_TASKS_LOGIN_ID, MY_TASKS_AUTH_STATE_PATH);
});

setup("Board専用accountで認証状態を準備する", async ({ page }) => {
  await authenticate(page, BOARD_LOGIN_ID, BOARD_AUTH_STATE_PATH);
});
