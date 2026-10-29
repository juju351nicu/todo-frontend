import { useRouter } from "vue-router";

import { ROUTE_NAMES } from "@/app/router/routeNames";
import { useUserStore } from "@/features/auth/stores/user";

/**
 * Sessionが切れた（Backendが401を返した）ときに、ログイン画面へ戻す手順を1か所にまとめるcomposable。
 *
 * 手順は「画面の状態の片付け（任意）→ 画面に残したSession情報の破棄 → ログイン画面へ遷移」の順に固定する。
 * 片付けを先に行うのは、遷移の途中でDialogや他人のデータが一瞬でも残って見えないようにするため。
 * 401かどうかの判定（`isUnauthorizedApiError`）と、401以外のエラーの表示は呼出側が行う。
 *
 * 並行した要求が続けて401になったときに遷移を1回にまとめる仕組みは持たない。
 * 画面の外（ヘッダーの通知等）でも使い、ログインし直した後の401でも必ず戻すため。
 * 1回にまとめる必要がある画面（WBS）は、呼出側で記録してから呼ぶ。
 *
 * `setup`（composableの呼出し）の中で呼ぶ。Pinia storeのactionからは`useRouter`を使えないため使わない。
 *
 * @returns Sessionを破棄してログイン画面へ戻す`expireSession`
 */
export const useSessionExpiry = () => {
  const router = useRouter();
  const userStore = useUserStore();

  /**
   * 画面の状態を片付け、Session情報を破棄してログイン画面へ遷移する。
   *
   * @param cleanup 遷移の前に画面の状態（開いているDialog・取得済みのデータ等）を捨てる処理。なければ省略する
   */
  const expireSession = async (cleanup?: () => void): Promise<void> => {
    cleanup?.();
    userStore.clearSession();
    await router.push({ name: ROUTE_NAMES.login });
  };

  return { expireSession };
};
