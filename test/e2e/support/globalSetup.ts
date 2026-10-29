import { removeAuthStates, resetAuthStates } from "./authState";
import { runBrowserRegressionFixture, type BrowserRegressionFixture } from "./databaseFixture";

const FIXTURES: readonly BrowserRegressionFixture[] = [
  "dashboard",
  "my-tasks",
  "board",
  "project-template",
  "task-recurrence",
  "authorization",
  "attendance-month",
  "wbs-journey",
];

/** staleな認証状態を捨て、各journeyを毎回同じ専用fixtureから開始する。 */
const globalSetup = (): void => {
  resetAuthStates();
  const preparedFixtures: BrowserRegressionFixture[] = [];
  try {
    for (const fixture of FIXTURES) {
      runBrowserRegressionFixture(fixture, "prepare");
      preparedFixtures.push(fixture);
    }
  } catch (setupError: unknown) {
    const cleanupErrors: unknown[] = [];
    for (const fixture of preparedFixtures.reverse()) {
      try {
        runBrowserRegressionFixture(fixture, "cleanup");
      } catch (cleanupError: unknown) {
        cleanupErrors.push(cleanupError);
      }
    }
    removeAuthStates();
    if (cleanupErrors.length > 0) {
      // 準備の失敗を`cause`にも付け、ログの最初に準備の失敗の原因が出るようにする。
      throw new AggregateError(
        [setupError, ...cleanupErrors],
        "E2E fixtureの準備とrollback cleanupに失敗しました。",
        { cause: setupError }
      );
    }
    throw setupError;
  }
};

export default globalSetup;
