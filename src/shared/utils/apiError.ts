import type { ErrorResponse } from "@/shared/types/error";

/**
 * feature APIのHTTPエラー（非2xx）の基底クラス。statusとBackendのエラー本文を持つ。
 *
 * featureごとのAPI例外（`ProjectApiError`等）はこのクラスを継承し、名前とAPIの表示名だけを渡す。
 * 画面は`instanceof ProjectApiError`のようにfeatureの例外で判定でき、401の判定のように
 * featureを問わない処理は`instanceof ApiError`で判定できる。
 * `name`はクラス名から求めず引数で受け取る（本番buildの圧縮でクラス名が変わっても、同じ名前にするため）。
 */
export abstract class ApiError extends Error {
  /** BackendのHTTP status。 */
  readonly status: number;

  /** Backendのエラー本文。空本文・非JSON本文の場合はnull。 */
  readonly errorResponse: ErrorResponse | null;

  /**
   * @param name 例外の名前（継承したクラスの名前と同じ文字列）
   * @param apiLabel メッセージに出すAPIの表示名（例: `Project API`）
   * @param status BackendのHTTP status
   * @param errorResponse Backendのエラー本文。読めなかった場合はnull
   */
  protected constructor(
    name: string,
    apiLabel: string,
    status: number,
    errorResponse: ErrorResponse | null
  ) {
    super(`${apiLabel}の実行に失敗しました。status=${status}`);
    this.name = name;
    this.status = status;
    this.errorResponse = errorResponse;
  }
}

/**
 * Sessionが切れた（Backendが401を返した）feature APIのエラーか判定する。
 *
 * @param error 画面が受け取った例外
 * @returns feature API例外で、statusが401の場合true
 */
export const isUnauthorizedApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 401;

/** 競合回復中に旧エラーより優先する現在の認証・認可・公開範囲status。 */
export const API_RECOVERY_PRIORITY_STATUSES: ReadonlySet<number> = new Set([
  401, 403, 404,
]);

/**
 * Backendの失敗Responseを共通ErrorResponseとして読み取る。
 * Spring Security等が返す空本文または非JSON本文は、解析失敗を呼出側へ漏らさずnullへ正規化する。
 * 成功Response、204 Response、binary downloadの解析には使用しない。
 *
 * @param response Backendの非2xx Response
 * @returns JSON本文を解析できた場合はその値、空本文または非JSON本文の場合はnull
 */
export const readErrorResponse = async (
  response: Response
): Promise<ErrorResponse | null> => {
  try {
    return (await response.json()) as ErrorResponse;
  } catch (_error: unknown) {
    return null;
  }
};

/**
 * HTTP成功Responseを本文へ触れず通過させ、失敗Responseだけをfeature固有例外へ変換する。
 * 204とbinary downloadを含む成功本文は呼出側が処理するため、この関数では消費しない。
 *
 * @param response Backend Response
 * @param createError statusと安全に解析したエラー本文からfeature固有例外を生成する関数
 * @throws createErrorが生成した例外。Responseが非2xxの場合だけ送出する
 */
export const ensureApiSuccess = async (
  response: Response,
  createError: (
    status: number,
    errorResponse: ErrorResponse | null
  ) => Error
): Promise<void> => {
  if (!response.ok) {
    throw createError(response.status, await readErrorResponse(response));
  }
};

/**
 * Backend共通エラーに指定code・fieldの組み合わせが含まれるか判定する。
 * message本文はlocaleで変化するため機械判定には使用しない。
 *
 * @param errorResponse feature API例外が保持するBackend共通エラー
 * @param errorCode Backendと合意済みの安定error code
 * @param field 対象field。指定しない場合はcodeだけを判定する
 * @returns codeと任意のfieldが一致する項目がある場合true
 */
export const hasApiFieldError = (
  errorResponse: ErrorResponse | null,
  errorCode: string,
  field?: string
): boolean =>
  Array.isArray(errorResponse?.fieldErrors) &&
  errorResponse.fieldErrors.some(
    (fieldError) =>
      fieldError !== null &&
      typeof fieldError === "object" &&
      fieldError.errorCode === errorCode &&
      (field === undefined || fieldError.field === field)
  );

/**
 * Backend共通エラーから、画面が契約済みcodeの利用者向けmessageだけを取り出す。
 * 本文なし、構造不正、空message、未知またはnullのcodeを1件でも含む場合は、
 * Backendの予期しない本文を部分表示せずFrontendの安全なfallbackだけを返す。
 *
 * @param errorResponse feature API例外が保持するBackend共通エラー
 * @param knownErrorCodes 画面が表示契約を持つerror code集合
 * @param fallback bodyなし・非JSON・未知code等に使用する固定文言
 * @returns Backend順を維持したmessage一覧、またはfallback 1件
 */
export const resolveApiErrorMessages = (
  errorResponse: ErrorResponse | null,
  knownErrorCodes: ReadonlySet<string>,
  fallback: string
): string[] => {
  if (
    !Array.isArray(errorResponse?.fieldErrors) ||
    errorResponse.fieldErrors.length === 0
  ) {
    return [fallback];
  }

  const messages: string[] = [];
  for (const fieldError of errorResponse.fieldErrors) {
    if (
      fieldError === null ||
      typeof fieldError !== "object" ||
      typeof fieldError.errorCode !== "string" ||
      !knownErrorCodes.has(fieldError.errorCode) ||
      typeof fieldError.field !== "string" ||
      typeof fieldError.message !== "string" ||
      fieldError.message.trim().length === 0
    ) {
      return [fallback];
    }
    messages.push(fieldError.message.trim());
  }
  return messages;
};
