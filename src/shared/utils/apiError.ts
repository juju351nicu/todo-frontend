import type { ErrorResponse } from "@/shared/types/error";

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
