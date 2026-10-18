import { describe, expect, it, vi } from "vitest";

import {
  API_RECOVERY_PRIORITY_STATUSES,
  ensureApiSuccess,
  hasApiFieldError,
  readErrorResponse,
  resolveApiErrorMessages,
} from "@/shared/utils/apiError";

const KNOWN_CODES = new Set(["KNOWN_ERROR", "VALIDATION_ERROR"]);

describe("API error表示utility", () => {
  it("競合回復では現在の認証・認可・公開範囲statusだけを優先する", () => {
    expect([...API_RECOVERY_PRIORITY_STATUSES]).toEqual([401, 403, 404]);
    expect(API_RECOVERY_PRIORITY_STATUSES.has(409)).toBe(false);
  });

  it("JSONの失敗Response本文を共通ErrorResponseとして返す", async () => {
    const response = new Response(
      JSON.stringify({
        fieldErrors: [
          {
            errorCode: "KNOWN_ERROR",
            field: "request",
            message: "処理に失敗しました。",
          },
        ],
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );

    await expect(readErrorResponse(response)).resolves.toEqual({
      fieldErrors: [
        {
          errorCode: "KNOWN_ERROR",
          field: "request",
          message: "処理に失敗しました。",
        },
      ],
    });
  });

  it.each([
    ["空本文", new Response(null, { status: 403 })],
    [
      "非JSON本文",
      new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      }),
    ],
  ])("%sはnullへ正規化する", async (_condition, response) => {
    await expect(readErrorResponse(response)).resolves.toBeNull();
  });

  it.each([
    ["204", new Response(null, { status: 204 })],
    ["binary", new Response(new Uint8Array([1, 2]), { status: 200 })],
  ])("%s成功Responseの本文を消費しない", async (_condition, response) => {
    const createError = vi.fn(() => new Error("呼ばれない例外"));

    await ensureApiSuccess(response, createError);

    expect(createError).not.toHaveBeenCalled();
    expect(response.bodyUsed).toBe(false);
  });

  it("非2xxのstatusと解析済み本文からfeature固有例外を生成する", async () => {
    const responseBody = {
      fieldErrors: [
        {
          errorCode: "KNOWN_ERROR",
          field: "request",
          message: "処理に失敗しました。",
        },
      ],
    };
    const response = new Response(JSON.stringify(responseBody), { status: 409 });
    const expectedError = new Error("feature固有例外");
    const createError = vi.fn(() => expectedError);

    await expect(ensureApiSuccess(response, createError)).rejects.toBe(
      expectedError
    );
    expect(createError).toHaveBeenCalledWith(409, responseBody);
  });

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
