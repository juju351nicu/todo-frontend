import { describe, expect, it } from "vitest";

import {
  hasApiFieldError,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";

const KNOWN_CODES = new Set(["KNOWN_ERROR", "VALIDATION_ERROR"]);

describe("API error表示utility", () => {
  it("契約済みcodeの複数field messageをBackend順で返す", () => {
    const response = {
      fieldErrors: [
        {
          errorCode: "VALIDATION_ERROR",
          field: "title",
          message: " タイトルを入力してください。 ",
        },
        {
          errorCode: "VALIDATION_ERROR",
          field: "dueDate",
          message: "期限を確認してください。",
        },
      ],
    };

    expect(
      resolveApiErrorMessages(response, KNOWN_CODES, "処理に失敗しました。")
    ).toEqual([
      "タイトルを入力してください。",
      "期限を確認してください。",
    ]);
  });

  it.each([
    ["本文なし", null],
    ["field errorなし", { fieldErrors: [] }],
    [
      "未知code",
      {
        fieldErrors: [
          {
            errorCode: "UNKNOWN_ERROR",
            field: "request",
            message: "内部情報を含み得る未契約文言",
          },
        ],
      },
    ],
    [
      "null code",
      {
        fieldErrors: [
          { errorCode: null, field: "request", message: "未契約文言" },
        ],
      },
    ],
    [
      "空message",
      {
        fieldErrors: [
          { errorCode: "KNOWN_ERROR", field: "request", message: "   " },
        ],
      },
    ],
    [
      "field欠落",
      {
        fieldErrors: [
          { errorCode: "KNOWN_ERROR", message: "未契約の構造です。" },
        ],
      },
    ],
  ])("%sでは安全なfallbackだけを返す", (_condition, response) => {
    expect(
      resolveApiErrorMessages(response, KNOWN_CODES, "処理に失敗しました。")
    ).toEqual(["処理に失敗しました。"]);
  });

  it("未知codeが混在する場合は既知messageも部分表示しない", () => {
    const response = {
      fieldErrors: [
        {
          errorCode: "KNOWN_ERROR",
          field: "title",
          message: "公開可能な文言",
        },
        {
          errorCode: "UNKNOWN_ERROR",
          field: "detail",
          message: "未契約文言",
        },
      ],
    };

    expect(
      resolveApiErrorMessages(response, KNOWN_CODES, "処理に失敗しました。")
    ).toEqual(["処理に失敗しました。"]);
  });

  it("message本文ではなくcodeとfieldの組み合わせで判定する", () => {
    const response = {
      fieldErrors: [
        {
          errorCode: "KNOWN_ERROR",
          field: "featureCode",
          message: "localeで変わる文言",
        },
      ],
    };

    expect(hasApiFieldError(response, "KNOWN_ERROR", "featureCode")).toBe(true);
    expect(hasApiFieldError(response, "KNOWN_ERROR", "otherField")).toBe(false);
  });
});
