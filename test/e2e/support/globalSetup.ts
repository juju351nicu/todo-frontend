import { removeAuthState, resetAuthState } from "./authState";
import { runDashboardFixture } from "./databaseFixture";

/** staleな認証状態を捨て、毎回同じDashboard専用fixtureからE2Eを開始する。 */
const globalSetup = (): void => {
  resetAuthState();
  try {
    runDashboardFixture("prepare");
  } catch (error: unknown) {
    removeAuthState();
    throw error;
  }
};

export default globalSetup;
