import type { PermissionCode } from "@/features/auth/types/auth";
import { TASK_READ_PERMISSION_CODES } from "@/features/auth/types/auth";

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
 *
 * Project Task参照permissionを持つ利用者はMy Tasks、旧Todo参照permissionだけを持つ利用者はカレンダーへ移動する。
 * いずれも参照できない管理者はアカウント・ロール管理画面へ移動し、利用可能な入口がなければ権限不足画面へ移動する。
 *
 * @param permissionCodes Session APIから復元した利用者permission
 * @returns Vue Routerへ渡すルート名
 */
export const resolveAuthenticatedHomeRouteName = (
  permissionCodes: readonly PermissionCode[]
): "MyTasks" | "TodoCalendar" | "AccountAdministration" | "AccessDenied" => {
  if (permissionCodes.includes("TASK_READ")) {
    return "MyTasks";
  }
  if (hasAnyPermission(permissionCodes, TASK_READ_PERMISSION_CODES)) {
    return "TodoCalendar";
  }
  if (permissionCodes.includes("ACCOUNT_READ")) {
    return "AccountAdministration";
  }
  return "AccessDenied";
};
