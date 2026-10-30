import { describe, expect, it } from "vitest";

import {
  formatBillingDateTime,
  getBillableFeatureLabel,
  getBillingPlanLabel,
  getBillingSubscriptionStatusColor,
  getBillingSubscriptionStatusLabel,
  getReconciliationErrorLabel,
} from "@/features/billing/utils/billingDisplay";

describe("課金表示変換", () => {
  it("planと既知機能を利用者向け表示名へ変換する", () => {
    expect(getBillingPlanLabel("FREE")).toBe("Free");
    expect(getBillingPlanLabel("PRO")).toBe("Pro");
    expect(getBillableFeatureLabel("TASK_RECURRENCE")).toBe("繰り返しTask");
    expect(getBillableFeatureLabel("TEMPLATE_MANAGEMENT")).toBe("Task・Project Template管理");
  });

  it("Subscription状態を表示名とsemantic colorへ変換する", () => {
    expect(getBillingSubscriptionStatusLabel(null)).toBe("契約なし");
    expect(getBillingSubscriptionStatusLabel("active")).toBe("契約中");
    expect(getBillingSubscriptionStatusColor("active")).toBe("success");
    expect(getBillingSubscriptionStatusColor("past_due")).toBe("warning");
    expect(getBillingSubscriptionStatusColor("unpaid")).toBe("error");
    expect(getBillingSubscriptionStatusColor(null)).toBe("neutral");
  });

  it("未知の状態・機能・照合失敗codeは値自体を隠さず運用表示する", () => {
    expect(getBillingSubscriptionStatusLabel("future_status")).toBe("future_status");
    expect(getBillableFeatureLabel("FUTURE_FEATURE")).toBe("FUTURE_FEATURE");
    expect(getReconciliationErrorLabel("FUTURE_ERROR")).toBe("FUTURE_ERROR");
  });

  it("照合失敗codeと未設定日時を表示用文言へ変換する", () => {
    expect(getReconciliationErrorLabel("STRIPE_TEMPORARY_FAILURE")).toBe("Stripe一時障害");
    expect(getReconciliationErrorLabel(null)).toBe("なし");
    expect(formatBillingDateTime(null)).toBe("—");
  });
});
