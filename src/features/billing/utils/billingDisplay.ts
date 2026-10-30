import type {
  BillableFeatureCode,
  BillingPlanCode,
  BillingSubscriptionStatus,
} from "@/features/billing/types/billing";
import { formatShortDateTime } from "@/shared/utils/dateTime";

const PLAN_LABELS: Readonly<Record<BillingPlanCode, string>> = {
  FREE: "Free",
  PRO: "Pro",
};

const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  incomplete: "支払い未完了",
  incomplete_expired: "支払い期限切れ",
  trialing: "トライアル中",
  active: "契約中",
  past_due: "支払い確認中",
  canceled: "終了",
  unpaid: "未払い",
  paused: "停止中",
};

const FEATURE_LABELS: Readonly<Record<string, string>> = {
  TASK_RECURRENCE: "繰り返しTask",
  TEMPLATE_MANAGEMENT: "Task・Project Template管理",
  DASHBOARD_ADVANCED: "高度Dashboard",
};

const RECONCILIATION_ERROR_LABELS: Readonly<Record<string, string>> = {
  STRIPE_TEMPORARY_FAILURE: "Stripe一時障害",
  STRIPE_PERMANENT_FAILURE: "Stripe応答不整合",
  PROJECTION_CONFLICT: "課金projection競合",
};

/** plan codeを利用者向け表示名へ変換する。 */
export const getBillingPlanLabel = (planCode: BillingPlanCode): string => PLAN_LABELS[planCode];

/** Subscription状態を利用者向け表示名へ変換する。未知値は内部値を説明として表示する。 */
export const getBillingSubscriptionStatusLabel = (
  status: BillingSubscriptionStatus | string | null
): string => (status === null ? "契約なし" : (SUBSCRIPTION_STATUS_LABELS[status] ?? status));

/** Subscription状態を意味に対応するNuxt UI semantic colorへ変換する。 */
export const getBillingSubscriptionStatusColor = (
  status: BillingSubscriptionStatus | string | null
): "neutral" | "success" | "warning" | "error" => {
  if (status === "active" || status === "trialing") {
    return "success";
  }
  if (status === "past_due" || status === "incomplete") {
    return "warning";
  }
  if (
    status === "incomplete_expired" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "paused"
  ) {
    return "error";
  }
  return "neutral";
};

/** 有料機能codeを利用者向け表示名へ変換する。 */
export const getBillableFeatureLabel = (featureCode: BillableFeatureCode | string): string =>
  FEATURE_LABELS[featureCode] ?? featureCode;

/** nullableな課金日時を短い端末時刻へ変換する。未設定は「—」を返す。 */
export const formatBillingDateTime = (value: string | null): string =>
  value === null ? "—" : formatShortDateTime(value);

/** 照合失敗codeを運用担当者向けの表示名へ変換する。未知codeは安定code自体を表示する。 */
export const getReconciliationErrorLabel = (errorCode: string | null): string =>
  errorCode === null ? "なし" : (RECONCILIATION_ERROR_LABELS[errorCode] ?? errorCode);
