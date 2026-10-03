import { removeAuthStates } from "./authState";
import {
  runBrowserRegressionFixture,
  type BrowserRegressionFixture,
} from "./databaseFixture";

const FIXTURES: readonly BrowserRegressionFixture[] = [
  "attendance-month",
  "authorization",
  "task-recurrence",
  "project-template",
  "board",
  "my-tasks",
  "dashboard",
];

/** 成否にかかわらず全専用DB fixtureとSession Cookieを削除する。 */
const globalTeardown = (): void => {
  const cleanupErrors: unknown[] = [];
  try {
    for (const fixture of FIXTURES) {
      try {
        runBrowserRegressionFixture(fixture, "cleanup");
      } catch (cleanupError: unknown) {
        cleanupErrors.push(cleanupError);
      }
    }
  } finally {
    removeAuthStates();
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "一部のE2E fixtureをcleanupできませんでした。"
    );
  }
};

export default globalTeardown;
