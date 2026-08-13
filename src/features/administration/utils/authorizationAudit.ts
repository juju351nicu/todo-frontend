import type { AuthorizationAuditAction } from "@/features/administration/types/administration";

const ACTION_LABELS: Readonly<Record<AuthorizationAuditAction, string>> = {
  ROLE_ASSIGNED: "付与",
  ROLE_REVOKED: "取消",
};

const ACTION_COLORS: Readonly<Record<AuthorizationAuditAction, string>> = {
  ROLE_ASSIGNED: "success",
  ROLE_REVOKED: "warning",
};

/** Backendの権限変更操作コードを日本語表示へ変換する。 */
export const getAuthorizationAuditActionLabel = (
  action: AuthorizationAuditAction
): string => ACTION_LABELS[action];

/** Backendの権限変更操作コードに対応するVuetify色を返す。 */
export const getAuthorizationAuditActionColor = (
  action: AuthorizationAuditAction
): string => ACTION_COLORS[action];

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

/** ロールコード集合を一覧セル用の読点区切り文字列へ変換する。 */
export const formatRoleCodes = (roleCodes: readonly string[]): string =>
  roleCodes.length === 0 ? "なし" : roleCodes.join("、");
