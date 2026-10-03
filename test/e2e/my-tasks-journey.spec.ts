import { expect, test } from "./fixtures/test";
import { runBrowserRegressionFixture } from "./support/databaseFixture";

const INITIAL_TITLE = "Browser My Tasks Today";
const UPDATED_TITLE = "Browser My Tasks Today Updated";
const UPDATED_DETAIL =
  "Playwrightから更新し、Board再読込とWBS反映を確認するTask";

test("My Tasksから同じTaskをBoardで更新し再読込後もWBSへ反映する", async ({
  page,
}) => {
  await page.goto("/my-tasks");

  await expect(page.getByRole("heading", { name: "My Tasks" })).toBeVisible();
  await expect(page.getByText("Browser My Tasks Overdue", { exact: true })).toBeVisible();
  await expect(page.getByText(INITIAL_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByText("Browser My Tasks Upcoming", { exact: true })).toBeVisible();

  await page.getByText(INITIAL_TITLE, { exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/\d+\/board\?taskId=\d+$/);
  const taskDialog = page.getByRole("dialog");
  await expect(taskDialog.getByText("Taskを編集", { exact: true })).toBeVisible();
  await expect(taskDialog.getByLabel("タイトル")).toHaveValue(INITIAL_TITLE);

  await taskDialog.getByLabel("タイトル").fill(UPDATED_TITLE);
  await taskDialog.getByLabel("詳細").fill(UPDATED_DETAIL);
  await taskDialog.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("Taskを更新しました。", { exact: true })).toBeVisible();
  await expect(page.getByText(UPDATED_TITLE, { exact: true })).toBeVisible();

  await page.reload();

  const reloadedTaskDialog = page.getByRole("dialog");
  await expect(reloadedTaskDialog.getByLabel("タイトル")).toHaveValue(
    UPDATED_TITLE
  );
  await expect(reloadedTaskDialog.getByLabel("詳細")).toHaveValue(
    UPDATED_DETAIL
  );

  await reloadedTaskDialog
    .getByRole("button", { name: "日別実績を入力", exact: true })
    .click();

  await expect(page).toHaveURL(
    /\/projects\/\d+\/wbs\?taskId=\d+&panel=work-logs$/
  );
  await expect(
    page
      .locator(".wbs-table tbody tr")
      .filter({ hasText: UPDATED_TITLE })
  ).toHaveCount(1);
  await expect(
    page.getByText(`Task日別実績工数: 2 ${UPDATED_TITLE}`, { exact: true })
  ).toBeVisible();

  if (process.env.E2E_SKIP_DATABASE_FIXTURE !== "true") {
    const inspection = runBrowserRegressionFixture(
      "my-tasks",
      "inspect-stage10d2"
    );
    expect(inspection).toContain("updated_task_count=1");
  }
});
