import { removeAuthState } from "./authState";
import { runDashboardFixture } from "./databaseFixture";

/** 成否にかかわらず専用DB fixtureとSession Cookieを削除する。 */
const globalTeardown = (): void => {
  try {
    runDashboardFixture("cleanup");
  } finally {
    removeAuthState();
  }
};

export default globalTeardown;
