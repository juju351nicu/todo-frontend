import { describe, expect, it } from "vitest";

import { WbsApiError } from "@/features/wbs/api/wbsApi";
import { resolveWbsStandardErrorMessages } from "@/features/wbs/utils/apiErrors";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";

const messages = {
  forbidden: "権限がありません。",
  notFound: "見つかりません。",
  conflict: "競合しました。",
  failed: "失敗しました。",
};

/** 契約済みcodeのBackend messageを1件持つエラーResponse。 */
const knownCodeResponse = {
  fieldErrors: [
    {
      errorCode: "WBS_EVM_ACTIVE_BASELINE_REQUIRED",
      field: "baseline",
      message: "active baselineを作成してください。",
    },
  ],
};

describe("標準的なWBS APIエラーのmessage変換", () => {
  it("WbsApiError以外は接続失敗として扱う", () => {
    expect(resolveWbsStandardErrorMessages(new TypeError("Failed to fetch"), messages)).toEqual({
      type: "messages",
      messages: [DISPLAY_MESSAGES.common.connectionFailed],
    });
  });

  it("401はmessageではなくSession失効処理が必要という結果にする", () => {
    expect(resolveWbsStandardErrorMessages(new WbsApiError(401, null), messages)).toEqual({
      type: "unauthorized",
    });
  });

  it.each([
    [403, "権限がありません。"],
    [404, "見つかりません。"],
  ])("%iはBackend本文があっても固定messageにする", (status, expected) => {
    expect(
      resolveWbsStandardErrorMessages(new WbsApiError(status, knownCodeResponse), messages)
    ).toEqual({ type: "messages", messages: [expected] });
  });

  it("409は契約済みcodeのBackend messageを優先し、なければ競合messageにする", () => {
    expect(
      resolveWbsStandardErrorMessages(new WbsApiError(409, knownCodeResponse), messages)
    ).toEqual({ type: "messages", messages: ["active baselineを作成してください。"] });
    expect(resolveWbsStandardErrorMessages(new WbsApiError(409, null), messages)).toEqual({
      type: "messages",
      messages: ["競合しました。"],
    });
  });

  it("409用のmessageを省略した場合、409はその他の失敗として扱う", () => {
    const { conflict: _conflict, ...withoutConflict } = messages;

    expect(resolveWbsStandardErrorMessages(new WbsApiError(409, null), withoutConflict)).toEqual({
      type: "messages",
      messages: ["失敗しました。"],
    });
  });

  it("その他のstatusは未知codeのBackend本文を表示せず既定messageにする", () => {
    const unknownCodeResponse = {
      fieldErrors: [{ errorCode: "UNKNOWN", field: "x", message: "内部の詳細" }],
    };

    expect(
      resolveWbsStandardErrorMessages(new WbsApiError(500, unknownCodeResponse), messages)
    ).toEqual({ type: "messages", messages: ["失敗しました。"] });
  });
});
