import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { AUTH_STATE_PATHS } from "./paths";

/** 古いSessionを再利用しないよう全認証状態fileを削除し、保存directoryだけを作る。 */
export const resetAuthStates = (): void => {
  for (const authStatePath of AUTH_STATE_PATHS) {
    rmSync(authStatePath, { force: true });
    mkdirSync(dirname(authStatePath), { recursive: true });
  }
};

/** E2E終了後にSession Cookieを含む全認証状態fileを必ず削除する。 */
export const removeAuthStates = (): void => {
  for (const authStatePath of AUTH_STATE_PATHS) {
    rmSync(authStatePath, { force: true });
  }
};
