import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";
import { AUTHORIZATION_TARGET_AUTH_STATE_PATH } from "./support/paths";

const TARGET_EMAIL = "authorization-target-browser@local.invalid";
const TARGET_LOGIN_ID = "authorization-target-browser";
const PASSWORD = process.env.E2E_PASSWORD ?? "password";

/** 権限変更対象者としてログインし直し、変更後permissionを新しいSessionへ読み込む。 */
const loginAsTarget = async (page: Page): Promise<void> => {
  await page.getByPlaceholder("ログインID").fill(TARGET_LOGIN_ID);
  await page.getByPlaceholder("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
};

test("ロール変更で既存Sessionを失効し再ログイン後は閲覧権限だけを反映する", async ({
  browser,
  page,
}) => {
  const targetContext = await browser.newContext({
    storageState: AUTHORIZATION_TARGET_AUTH_STATE_PATH,
  });
  const targetPage = await targetContext.newPage();

  try {
    await targetPage.goto("/dashboard");
    await expect(
      targetPage.getByRole("heading", { name: /Dashboard$/ })
    ).toBeVisible();

    await page.goto("/administration/accounts");
    await expect(
      page.getByText("アカウント・ロール管理", { exact: true })
    ).toBeVisible();
    await page
      .getByPlaceholder("表示名・メール・ロール")
      .fill(TARGET_EMAIL);

    const targetRow = page.getByRole("row").filter({ hasText: TARGET_EMAIL });
    await expect(targetRow).toHaveCount(1);
    await targetRow.getByRole("button", { name: "ロールを編集" }).click();

    const roleDialog = page.getByRole("dialog");
    await expect(
      roleDialog.getByText("ロール編集", { exact: true })
    ).toBeVisible();
    await roleDialog.getByLabel("ユーザー（USER）").uncheck();
    await roleDialog
      .getByLabel("閲覧管理者（READ_ONLY_ADMIN）")
      .check();
    await roleDialog.getByRole("button", { name: "保存", exact: true }).click();

    await expect(
      page.getByText("権限 対象者さんのロールを更新しました。", {
        exact: true,
      })
    ).toBeVisible();

    await targetPage.reload();
    await expect(targetPage).toHaveURL(/\/$/);
    await expect(
      targetPage.getByRole("button", { name: "ログイン", exact: true })
    ).toBeVisible();

    if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
      const invalidatedInspection = runBrowserRegressionFixture(
        "authorization",
        "inspect-stage10d2"
      );
      expect(invalidatedInspection).toContain("role_contract=1");
      expect(invalidatedInspection).toContain("account_contract=1");
      expect(invalidatedInspection).toContain("audit_contract=1");
      expect(invalidatedInspection).toContain("target_session_count=0");
      expect(invalidatedInspection).toContain("fixture_account_count=2");
    }

    await loginAsTarget(targetPage);
    await targetPage.goto("/administration/accounts");
    await expect(
      targetPage.getByText("アカウント・ロール管理", { exact: true })
    ).toBeVisible();
    await expect(
      targetPage.getByText(
        "現在のロールを参照できます。変更にはACCOUNT_ROLE_UPDATE permissionが必要です。",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      targetPage.getByRole("button", { name: "ロールを編集" })
    ).toHaveCount(0);

    await page.goto("/administration/authorization-audit-logs");
    await expect(
      page.getByText("権限変更監査ログ", { exact: true })
    ).toBeVisible();
    const targetAuditRows = page
      .getByRole("row")
      .filter({ hasText: "権限 対象者" });
    await expect(targetAuditRows).toHaveCount(2);
    await expect(
      targetAuditRows.filter({ hasText: "取消" }).filter({ hasText: "USER" })
    ).toHaveCount(1);
    await expect(
      targetAuditRows
        .filter({ hasText: "付与" })
        .filter({ hasText: "READ_ONLY_ADMIN" })
    ).toHaveCount(1);

    if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
      const reloginInspection = runBrowserRegressionFixture(
        "authorization",
        "inspect-stage10d2"
      );
      expect(reloginInspection).toContain("target_session_count=1");
    }
  } finally {
    await targetContext.close();
  }
});
