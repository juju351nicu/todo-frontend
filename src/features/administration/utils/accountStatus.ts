import type { AccountStatus } from "@/features/administration/types/administration";
import type { SemanticColor } from "@/shared/types/color";

const STATUS_LABELS: Readonly<Record<AccountStatus, string>> = {
  ACTIVE: "有効",
  LOCKED: "ロック中",
  DISABLED: "無効",
};

const STATUS_COLORS: Readonly<Record<AccountStatus, SemanticColor>> = {
  ACTIVE: "success",
  LOCKED: "warning",
  DISABLED: "neutral",
};

/** Backendのアカウント状態コードを日本語表示へ変換する。 */
export const getAccountStatusLabel = (status: AccountStatus): string =>
  STATUS_LABELS[status];

/** Backendのアカウント状態コードに対応する表示色を返す。 */
export const getAccountStatusColor = (status: AccountStatus): SemanticColor =>
  STATUS_COLORS[status];
