import type { PermissionCode } from "@/features/auth/types/auth";

/**
 * 利用者が指定permissionのいずれかを持つか判定する。
 *
 * @param permissionCodes Session APIから復元した利用者permission
 * @param requiredPermissionCodes 画面または操作が要求するpermission
 * @returns 要求permissionが空、または1件以上一致する場合はtrue
 */
export const hasAnyPermission = (
  permissionCodes: readonly PermissionCode[],
  requiredPermissionCodes: readonly PermissionCode[]
): boolean =>
  requiredPermissionCodes.length === 0 ||
  requiredPermissionCodes.some((permissionCode) =>
    permissionCodes.includes(permissionCode)
  );

/**
 * ログイン後またはNot Found画面から戻る既定ルートを決定する。
 * Basic Dashboardはpermission別にavailable=falseを返すため、全認証利用者が同じ入口を使用する。
 *
 * @param _permissionCodes Session APIから復元した利用者permission。呼出契約維持のため受け取る
 * @returns Vue Routerへ渡すルート名
 */
export const resolveAuthenticatedHomeRouteName = (
  _permissionCodes: readonly PermissionCode[]
): "Dashboard" => "Dashboard";
