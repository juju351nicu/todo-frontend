import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

import { AUTH_STATE_PATH } from "./paths";

/** 古いSessionを再利用しないよう認証状態fileを削除し、保存directoryだけを作る。 */
export const resetAuthState = (): void => {
  rmSync(AUTH_STATE_PATH, { force: true });
  mkdirSync(dirname(AUTH_STATE_PATH), { recursive: true });
};

/** E2E終了後にSession Cookieを含む認証状態fileを必ず削除する。 */
export const removeAuthState = (): void => {
  rmSync(AUTH_STATE_PATH, { force: true });
};
