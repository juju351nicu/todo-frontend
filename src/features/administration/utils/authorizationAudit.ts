import type { AuthorizationAuditAction } from "@/features/administration/types/administration";
import type { SemanticColor } from "@/shared/types/color";

const ACTION_LABELS: Readonly<Record<AuthorizationAuditAction, string>> = {
  ROLE_ASSIGNED: "付与",
  ROLE_REVOKED: "取消",
};

const ACTION_COLORS: Readonly<Record<AuthorizationAuditAction, SemanticColor>> = {
  ROLE_ASSIGNED: "success",
  ROLE_REVOKED: "warning",
};

/** Backendの権限変更操作コードを日本語表示へ変換する。 */
export const getAuthorizationAuditActionLabel = (
  action: AuthorizationAuditAction
): string => ACTION_LABELS[action];

/** Backendの権限変更操作コードに対応する表示色を返す。 */
export const getAuthorizationAuditActionColor = (
  action: AuthorizationAuditAction
): SemanticColor => ACTION_COLORS[action];

/**
 * BackendのUTC Instantを利用端末の日時表示へ変換する。
 *
 * @param occurredAt ISO 8601形式の操作時刻
 * @returns 日本語ロケールの日時。不正値の場合は確認可能な元文字列
 */
export const formatAuthorizationAuditOccurredAt = (
  occurredAt: string
): string => {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return occurredAt;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

/**
 * ロールコードを表示名へ変換する。
 *
 * @param roleCode Backendのロールコード（例 `ATTENDANCE_MANAGER`）
 * @param roleNamesByCode ロール一覧APIから作ったコード→表示名の対応。取得できなかった場合は空
 * @returns 表示名。対応にないコード（削除済みロール・一覧の取得失敗）はコード自体
 */
export const resolveRoleName = (
  roleCode: string,
  roleNamesByCode: ReadonlyMap<string, string>
): string => roleNamesByCode.get(roleCode) ?? roleCode;

/**
 * ロールコード集合を一覧セル用の読点区切りの表示名へ変換する。
 *
 * @param roleCodes 変更前・変更後のロールコード集合
 * @param roleNamesByCode コード→表示名の対応（`resolveRoleName`と同じ）
 * @returns 空集合は「なし」
 */
export const formatRoleNames = (
  roleCodes: readonly string[],
  roleNamesByCode: ReadonlyMap<string, string>
): string =>
  roleCodes.length === 0
    ? "なし"
    : roleCodes
        .map((roleCode) => resolveRoleName(roleCode, roleNamesByCode))
        .join("、");
