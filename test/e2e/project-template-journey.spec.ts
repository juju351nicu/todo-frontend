import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";

const SOURCE_PROJECT_KEY = "BROWSER-PT-SOURCE";
const TEMPLATE_NAME = "Browser Project Template E2E";
const GENERATED_PROJECT_NAME = "Browser Project Template Generated";
const CONFIGURED_MEMBER_ACCOUNT_ID =
  process.env.E2E_PROJECT_TEMPLATE_MEMBER_ACCOUNT_ID;

/** Project一覧から採番IDへ依存せず専用Source ProjectのBoardを開く。 */
const openSourceBoard = async (page: Page): Promise<void> => {
  await page.goto("/projects");
  const projectCard = page.locator(".v-card").filter({
    has: page.getByText(SOURCE_PROJECT_KEY, { exact: true }),
  });
  await projectCard.getByRole("button", { name: "Boardを開く" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  await expect(
    page.getByRole("heading", { name: "Browser Project Template Source" })
  ).toBeVisible();
};

/** DB fixtureの機械判定出力から、採番されたmember account IDだけを取得する。 */
const readMemberAccountId = (): number => {
  if (CONFIGURED_MEMBER_ACCOUNT_ID !== undefined) {
    const accountId = Number(CONFIGURED_MEMBER_ACCOUNT_ID);
    if (Number.isSafeInteger(accountId) && accountId > 0) {
      return accountId;
    }
    throw new Error(
      "E2E_PROJECT_TEMPLATE_MEMBER_ACCOUNT_IDには正の整数を指定してください。"
    );
  }
  if (process.env.E2E_SKIP_DATABASE_FIXTURE === "true") {
    throw new Error(
      "外部fixture使用時はE2E_PROJECT_TEMPLATE_MEMBER_ACCOUNT_IDが必要です。"
    );
  }
  const inspection = runBrowserRegressionFixture(
    "project-template",
    "inspect-stage10d2"
  );
  const match = inspection.match(/^member_account_id=(\d+)$/m);
  if (match === null) {
    throw new Error("Project Template fixtureのmember account IDを取得できませんでした。");
  }
  return Number(match[1]);
};

test("Project全体をTemplateへ保存し別Projectへ適用してlineageを保持する", async ({
  page,
}) => {
  const memberAccountId = readMemberAccountId();
  expect(memberAccountId).toBeGreaterThan(0);

  await openSourceBoard(page);
  await page
    .getByRole("button", { name: "ProjectをTemplateとして保存", exact: true })
    .click();

  const captureDialog = page.getByRole("dialog");
  await expect(
    captureDialog.getByText("ProjectをTemplateとして保存", { exact: true })
  ).toBeVisible();
  await captureDialog.getByLabel("Template名").fill(TEMPLATE_NAME);
  await captureDialog.getByLabel("Task日付の基準日").fill("2026-09-21");
  await captureDialog.getByRole("button", { name: "保存", exact: true }).click();

  await expect(
    page.getByText("ProjectをTemplateとして保存しました。", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "Templateを確認", exact: true }).click();

  await expect(page).toHaveURL(/\/project-templates$/);
  await expect(page.getByRole("heading", { name: TEMPLATE_NAME })).toBeVisible();
  await expect(page.getByText("WBS Task snapshot（4）", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Finish-to-Start依存（2）", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /1\.1 Browser PT Design/ })
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /1\.2 Browser PT Implementation/ })
  ).toBeVisible();

  await page.getByLabel("Projectキー").fill("BROWSER-PT-GENERATED");
  await page.getByLabel("Project名").fill(GENERATED_PROJECT_NAME);
  await page.getByLabel("Project開始日").fill("2026-10-05");
  await page
    .getByLabel("メンバー 1（MEMBER）")
    .fill(String(memberAccountId));
  await page
    .getByRole("button", {
      name: "Projectを作成してBoardを開く",
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  await expect(
    page.getByRole("heading", { name: GENERATED_PROJECT_NAME })
  ).toBeVisible();
  for (const title of [
    "Browser PT Delivery",
    "Browser PT Design",
    "Browser PT Implementation",
    "Browser PT Release",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
    const inspection = runBrowserRegressionFixture(
      "project-template",
      "inspect-stage10d2"
    );
    expect(inspection).toContain("template_count=1");
    expect(inspection).toContain("template_structure=2,3,4,3,2");
    expect(inspection).toContain("generated_project_count=1");
    expect(inspection).toContain("generated_structure=2,3,4,3,2");
    expect(inspection).toContain("generated_task_contract_count=4");
  }
});
