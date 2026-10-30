import type { AccountStatus } from "@/shared/types/accountStatus";

/** Backendが公開する初期課金plan code。 */
export type BillingPlanCode = "FREE" | "PRO";

/** Stripe Subscriptionの状態code。 */
export type BillingSubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

/** Backendが機能資格へ使用する有料機能code。 */
export type BillableFeatureCode = "TASK_RECURRENCE" | "TEMPLATE_MANAGEMENT" | "DASHBOARD_ADVANCED";

/** 本人用課金状態APIのResponse。Stripe識別子と請求先情報は含まない。 */
export interface BillingMeResponse {
  planCode: BillingPlanCode;
  /** 契約履歴がない場合はnull。 */
  subscriptionStatus: BillingSubscriptionStatus | null;
  /** 現在契約期間の排他的終了時刻。未確定または契約なしはnull。 */
  currentPeriodEndAt: string | null;
  cancelAtPeriodEnd: boolean;
  featureCodes: BillableFeatureCode[];
}

/** Checkout Session作成APIへ渡す販売allowlist内のplanと請求間隔。 */
export interface BillingCheckoutSessionCreateRequest {
  planCode: "PRO";
  billingInterval: "MONTHLY";
}

/** Stripe-hosted Checkout開始APIのResponse。 */
export interface BillingCheckoutSessionResponse {
  /** Stripe-hosted Checkoutの短命URL。永続化しない。 */
  checkoutUrl: string;
  /** Checkout URLの排他的失効時刻。 */
  expiresAt: string;
}

/** Stripe Customer Portal開始APIのResponse。 */
export interface BillingPortalSessionResponse {
  /** Stripe-hosted Customer Portalの短命URL。永続化しない。 */
  portalUrl: string;
}

/** 課金管理一覧に公開されるAccount単位の契約・資格・照合状態。 */
export interface BillingAdministrationAccount {
  accountId: number;
  displayName: string;
  accountStatus: AccountStatus;
  billingCustomerConfigured: boolean;
  planCode: BillingPlanCode;
  /** 契約履歴がない場合はnull。 */
  subscriptionStatus: BillingSubscriptionStatus | null;
  subscriptionAccessible: boolean;
  /** 現在契約期間の排他的終了時刻。 */
  currentPeriodEndAt: string | null;
  /** 最後に支払確認済みの利用期限。 */
  paidThroughAt: string | null;
  /** 支払失敗時の排他的猶予期限。 */
  graceUntilAt: string | null;
  cancelAtPeriodEnd: boolean;
  featureCodes: BillableFeatureCode[];
  lastSyncedAt: string | null;
  lastReconciledAt: string | null;
  nextReconcileAt: string | null;
  reconciliationInProgress: boolean;
  /** 秘密やpayloadを含まない安定した照合失敗code。 */
  lastReconcileErrorCode: string | null;
}

/** 課金管理Account一覧APIの0始まりページResponse。 */
export interface BillingAdministrationAccountListResponse {
  accounts: BillingAdministrationAccount[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
