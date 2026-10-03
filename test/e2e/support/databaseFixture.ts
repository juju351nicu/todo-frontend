import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BACKEND_PATH } from "./paths";

type DashboardFixtureAction = "prepare" | "cleanup";

const MYSQL_CONTAINER =
  process.env.E2E_MYSQL_CONTAINER ?? "work-management-mysql";
const MYSQL_DATABASE = process.env.E2E_DB_NAME ?? "todo";
const MYSQL_USER = process.env.E2E_DB_USER ?? "work_management_app";
const MYSQL_PASSWORD =
  process.env.E2E_DB_PASSWORD ?? "work_management_password";

/**
 * BackendのDashboard専用SQLをDocker MySQLへ流し、通常のローカルデータから分離したE2E状態を作る。
 * SQL本文やpasswordは標準出力へ書かず、失敗時も終了codeだけを呼出側へ返す。
 *
 * @param action fixtureの準備または削除
 */
export const runDashboardFixture = (
  action: DashboardFixtureAction
): void => {
  if (process.env.E2E_SKIP_DATABASE_FIXTURE === "true") {
    return;
  }

  const sqlPath = resolve(
    BACKEND_PATH,
    `scripts/browser-regression/dashboard/${action}.sql`
  );
  const sql = readFileSync(sqlPath, "utf8");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "-e",
      `MYSQL_PWD=${MYSQL_PASSWORD}`,
      MYSQL_CONTAINER,
      "mysql",
      "--default-character-set=utf8mb4",
      "-u",
      MYSQL_USER,
      MYSQL_DATABASE,
    ],
    {
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `Dashboard E2E fixture ${action} failed (exit=${result.status ?? "unknown"}).`
    );
  }
};
