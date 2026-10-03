import { expect, test as setup } from "@playwright/test";

import { AUTH_STATE_PATH } from "./support/paths";

const LOGIN_ID = process.env.E2E_LOGIN_ID ?? "dashboard-browser";
const PASSWORD = process.env.E2E_PASSWORD ?? "password";

setup("Dashboard専用accountで認証状態を準備する", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("ログインID").fill(LOGIN_ID);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /Dashboard$/ })
  ).toBeVisible();

  // storageStateはSession Cookieを含むため、Git管理外fileへだけ保存しartifactへ添付しない。
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
