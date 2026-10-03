import { type Locator, type Page } from "@playwright/test";

import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";

const PROJECT_KEY = "BROWSER-BOARD-E2E";
const INITIAL_TITLE = "Browser Board Created";
const INITIAL_DETAIL = "Playwrightから作成して列移動するTask";
const WINNER_TITLE = "Browser Board Winner";
const WINNER_DETAIL = "先行tabで確定した内容を競合後も保持するTask";
const STALE_TITLE = "Browser Board Stale";

/** 指定表示名のBoard列を、他列内のTask本文と混同せず取得する。 */
const getBoardColumn = (page: Page, name: string): Locator =>
  page.locator(".board-column").filter({
    has: page.getByRole("button", {
      name: `${name}へTaskを追加`,
      exact: true,
    }),
  });

/** 指定Board列にあるタイトル一致のTask cardを取得する。 */
const getTaskCard = (column: Locator, title: string): Locator =>
  column.locator(".task-card").filter({ hasText: title });

/** Project一覧から専用Projectを選択し、採番IDへ依存せずBoardを開く。 */
const openDedicatedBoard = async (page: Page): Promise<void> => {
  await page.goto("/projects");
  const projectCard = page.locator(".v-card").filter({
    has: page.getByText(PROJECT_KEY, { exact: true }),
  });
  await projectCard.getByRole("button", { name: "Boardを開く" }).click();
  await expect(page).toHaveURL(/\/projects\/\d+\/board$/);
  await expect(page.getByRole("heading", { name: "Browser Board Playwright" })).toBeVisible();
};

test("BoardでTaskを作成・列移動し2 tab競合後に先行更新へ回復する", async ({
  page,
}) => {
  await openDedicatedBoard(page);

  const todoColumn = getBoardColumn(page, "Todo");
  const progressColumn = getBoardColumn(page, "進行中");
  await todoColumn
    .getByRole("button", { name: "TodoへTaskを追加", exact: true })
    .click();

  const createDialog = page.getByRole("dialog");
  await expect(createDialog.getByText("Taskを追加", { exact: true })).toBeVisible();
  await createDialog.getByLabel("タイトル").fill(INITIAL_TITLE);
  await createDialog.getByLabel("詳細").fill(INITIAL_DETAIL);
  await createDialog.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("Taskを登録しました。", { exact: true })).toBeVisible();
  await expect(getTaskCard(todoColumn, INITIAL_TITLE)).toHaveCount(1);

  await getTaskCard(todoColumn, INITIAL_TITLE)
    .getByRole("button", { name: new RegExp(`^${INITIAL_TITLE}を移動`) })
    .press("ArrowRight");

  await expect(page.getByText("Taskを移動しました。", { exact: true })).toBeVisible();
  await expect(getTaskCard(todoColumn, INITIAL_TITLE)).toHaveCount(0);
  await expect(getTaskCard(progressColumn, INITIAL_TITLE)).toHaveCount(1);

  await page.reload();
  await expect(getTaskCard(getBoardColumn(page, "進行中"), INITIAL_TITLE)).toHaveCount(1);

  await getTaskCard(getBoardColumn(page, "進行中"), INITIAL_TITLE).click();
  const winnerDialog = page.getByRole("dialog");
  await expect(winnerDialog.getByText("Taskを編集", { exact: true })).toBeVisible();

  const stalePage = await page.context().newPage();
  await stalePage.goto(page.url());
  await getTaskCard(getBoardColumn(stalePage, "進行中"), INITIAL_TITLE).click();
  const staleDialog = stalePage.getByRole("dialog");
  await expect(staleDialog.getByText("Taskを編集", { exact: true })).toBeVisible();

  await winnerDialog.getByLabel("タイトル").fill(WINNER_TITLE);
  await winnerDialog.getByLabel("詳細").fill(WINNER_DETAIL);
  await winnerDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("Taskを更新しました。", { exact: true })).toBeVisible();
  await expect(getTaskCard(getBoardColumn(page, "進行中"), WINNER_TITLE)).toHaveCount(1);

  await staleDialog.getByLabel("タイトル").fill(STALE_TITLE);
  const conflictResponse = stalePage.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return (
      response.request().method() === "PUT" &&
      /\/api\/v1\/projects\/\d+\/tasks\/\d+$/.test(path)
    );
  });
  await staleDialog.getByRole("button", { name: "保存", exact: true }).click();
  expect((await conflictResponse).status()).toBe(409);

  await expect(stalePage.getByRole("dialog")).not.toBeVisible();
  await expect(
    getTaskCard(getBoardColumn(stalePage, "進行中"), WINNER_TITLE)
  ).toHaveCount(1);
  await expect(
    getTaskCard(getBoardColumn(stalePage, "進行中"), STALE_TITLE)
  ).toHaveCount(0);

  await stalePage.reload();
  await expect(
    getTaskCard(getBoardColumn(stalePage, "進行中"), WINNER_TITLE)
  ).toHaveCount(1);
  await stalePage.close();

  if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
    const inspection = runBrowserRegressionFixture(
      "board",
      "inspect-stage10d2"
    );
    expect(inspection).toContain("journey_task_count=1");
    expect(inspection).toContain("project_task_count=1");
  }
});
