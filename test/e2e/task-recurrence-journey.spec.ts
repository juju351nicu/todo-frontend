import { type Locator, type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";

const PROJECT_KEY = "BROWSER-TASK-RECURRENCE";
const BOUNDARY_TITLE = "Browser Boundary Recurring Task";
const UPDATED_TITLE = "Browser Stage10D2 Recurring Task";
const UPDATED_DETAIL = "停止・再読込・再開後も保持するsnapshot";
const RETRY_TITLE = "Browser Retry Recovery Task";

/** Project一覧から採番IDへ依存せず繰り返しTask専用Boardを開く。 */
const openDedicatedBoard = async (page: Page): Promise<void> => {
  await page.goto("/projects");
  const projectCard = page.locator(".v-card").filter({
    has: page.getByText(PROJECT_KEY, { exact: true }),
  });
  await projectCard.getByRole("button", { name: "Boardを開く" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  await expect(
    page.getByRole("heading", { name: "Browser Task Recurrence Regression" })
  ).toBeVisible();
};

/** Board headerから繰り返しTask Dialogを開き、規則一覧の取得完了を待つ。 */
const openRecurrenceDialog = async (
  page: Page,
  expectedRuleTitle = BOUNDARY_TITLE
) => {
  await page
    .getByRole("button", { name: "繰り返しTask", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(expectedRuleTitle, { exact: true })
  ).toBeVisible();
  return dialog;
};

/** Vuetify selectを表示ラベルで操作し、内部codeや採番IDへ依存させない。 */
const selectStatus = async (
  page: Page,
  dialog: Locator,
  label: "有効" | "一時停止"
): Promise<void> => {
  await dialog
    .locator(".v-input")
    .filter({ hasText: "状態" })
    .getByRole("combobox")
    .click();
  await page.getByRole("option", { name: label, exact: true }).click();
};

test("繰り返し規則を停止・再開しFAILED生成を手動retryする", async ({
  page,
}) => {
  await openDedicatedBoard(page);
  let dialog = await openRecurrenceDialog(page);

  await dialog.getByText(BOUNDARY_TITLE, { exact: true }).click();
  await dialog
    .getByRole("button", { name: "編集・停止", exact: true })
    .click();
  await dialog.getByLabel("Taskタイトル").fill(UPDATED_TITLE);
  await dialog.getByLabel("Task詳細").fill(UPDATED_DETAIL);
  await selectStatus(page, dialog, "一時停止");
  await dialog.getByRole("button", { name: "更新", exact: true }).click();

  await expect(
    dialog.getByText("繰り返しTask規則を更新しました。", { exact: true })
  ).toBeVisible();
  await expect(dialog.getByText("一時停止", { exact: true }).last()).toBeVisible();

  await dialog
    .getByRole("button", { name: "繰り返しTaskを閉じる" })
    .click();
  await page.reload();
  dialog = await openRecurrenceDialog(page, UPDATED_TITLE);
  await dialog.getByText(UPDATED_TITLE, { exact: true }).click();
  await expect(dialog.getByText(UPDATED_DETAIL, { exact: true })).toBeVisible();
  await expect(dialog.getByText("一時停止", { exact: true }).last()).toBeVisible();

  await dialog
    .getByRole("button", { name: "編集・停止", exact: true })
    .click();
  await selectStatus(page, dialog, "有効");
  await dialog.getByRole("button", { name: "更新", exact: true }).click();
  await expect(
    dialog.getByText("繰り返しTask規則を更新しました。", { exact: true })
  ).toBeVisible();
  await expect(dialog.getByText("有効", { exact: true }).last()).toBeVisible();

  await dialog.getByText(RETRY_TITLE, { exact: true }).click();
  const failedGenerationRow = dialog
    .getByRole("row")
    .filter({ hasText: "失敗" });
  await expect(failedGenerationRow).toHaveCount(1);
  await failedGenerationRow
    .getByRole("button", { name: "再試行", exact: true })
    .click();

  await expect(
    dialog.getByText("生成の再試行を受け付けました。", { exact: true })
  ).toBeVisible();
  await expect(dialog.getByText("待機中", { exact: true })).toBeVisible();
  await expect(dialog.getByText("有効", { exact: true }).last()).toBeVisible();

  if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
    const inspection = runBrowserRegressionFixture(
      "task-recurrence",
      "inspect-stage10d2"
    );
    expect(inspection).toContain("boundary_rule_contract=1");
    expect(inspection).toContain("retry_rule_contract=1");
    expect(inspection).toContain("retry_generation_contract=1");
    expect(inspection).toContain("fixture_structure=4,1");
  }
});
