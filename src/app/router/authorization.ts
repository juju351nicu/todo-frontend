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
 * Todo参照permissionを持つ通常利用者はカレンダーへ移動する。Todoを参照できない管理者は、
 * 既存会員画面へ移動し、どちらも利用できない場合は権限不足画面へ移動する。
 *
 * @param permissionCodes Session APIから復元した利用者permission
 * @returns Vue Routerへ渡すルート名
 */
export const resolveAuthenticatedHomeRouteName = (
  permissionCodes: readonly PermissionCode[]
): "TodoCalendar" | "MemberList" | "AccessDenied" => {
  if (hasAnyPermission(permissionCodes, TASK_READ_PERMISSION_CODES)) {
    return "TodoCalendar";
  }
  if (permissionCodes.includes("ACCOUNT_READ")) {
    return "MemberList";
  }
  return "AccessDenied";
};
