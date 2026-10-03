import { expect, test as setup, type Page } from "@playwright/test";

import {
  AUTHORIZATION_ADMIN_AUTH_STATE_PATH,
  AUTHORIZATION_TARGET_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_EMPLOYEE_AUTH_STATE_PATH,
  ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH,
  BOARD_AUTH_STATE_PATH,
  DASHBOARD_AUTH_STATE_PATH,
  MY_TASKS_AUTH_STATE_PATH,
  PROJECT_TEMPLATE_AUTH_STATE_PATH,
  TASK_RECURRENCE_AUTH_STATE_PATH,
} from "./support/paths";

const BOARD_LOGIN_ID = process.env.E2E_BOARD_LOGIN_ID ?? "board-browser";
const DASHBOARD_LOGIN_ID = process.env.E2E_LOGIN_ID ?? "dashboard-browser";
const MY_TASKS_LOGIN_ID =
  process.env.E2E_MY_TASKS_LOGIN_ID ?? "my-tasks-browser";
const PROJECT_TEMPLATE_LOGIN_ID =
  process.env.E2E_PROJECT_TEMPLATE_LOGIN_ID ?? "project-template-owner";
const TASK_RECURRENCE_LOGIN_ID =
  process.env.E2E_TASK_RECURRENCE_LOGIN_ID ?? "recurrence-owner";
const AUTHORIZATION_ADMIN_LOGIN_ID =
  process.env.E2E_AUTHORIZATION_ADMIN_LOGIN_ID ??
  "authorization-admin-browser";
const AUTHORIZATION_TARGET_LOGIN_ID =
  process.env.E2E_AUTHORIZATION_TARGET_LOGIN_ID ??
  "authorization-target-browser";
const ATTENDANCE_MONTH_EMPLOYEE_LOGIN_ID =
  process.env.E2E_ATTENDANCE_MONTH_EMPLOYEE_LOGIN_ID ??
  "attendance-month-browser";
const ATTENDANCE_MONTH_REVIEWER_LOGIN_ID =
  process.env.E2E_ATTENDANCE_MONTH_REVIEWER_LOGIN_ID ??
  "attendance-month-reviewer";
const ATTENDANCE_MONTH_CLOSER_LOGIN_ID =
  process.env.E2E_ATTENDANCE_MONTH_CLOSER_LOGIN_ID ??
  "attendance-month-closer";
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

setup("Project Template専用accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    PROJECT_TEMPLATE_LOGIN_ID,
    PROJECT_TEMPLATE_AUTH_STATE_PATH
  );
});

setup("繰り返しTask専用accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    TASK_RECURRENCE_LOGIN_ID,
    TASK_RECURRENCE_AUTH_STATE_PATH
  );
});

setup("権限変更管理者accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    AUTHORIZATION_ADMIN_LOGIN_ID,
    AUTHORIZATION_ADMIN_AUTH_STATE_PATH
  );
});

setup("権限変更対象accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    AUTHORIZATION_TARGET_LOGIN_ID,
    AUTHORIZATION_TARGET_AUTH_STATE_PATH
  );
});

setup("勤怠月次本人accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    ATTENDANCE_MONTH_EMPLOYEE_LOGIN_ID,
    ATTENDANCE_MONTH_EMPLOYEE_AUTH_STATE_PATH
  );
});

setup("勤怠月次確認者accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    ATTENDANCE_MONTH_REVIEWER_LOGIN_ID,
    ATTENDANCE_MONTH_REVIEWER_AUTH_STATE_PATH
  );
});

setup("勤怠月次締め担当accountで認証状態を準備する", async ({ page }) => {
  await authenticate(
    page,
    ATTENDANCE_MONTH_CLOSER_LOGIN_ID,
    ATTENDANCE_MONTH_CLOSER_AUTH_STATE_PATH
  );
});
