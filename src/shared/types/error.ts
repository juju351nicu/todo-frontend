/** Backendの入力項目エラー。 */
export interface FieldError {
  errorCode: string | null;
  field: string;
  message: string;
}

/** Backendの共通エラーレスポンス。 */
export interface ErrorResponse {
  fieldErrors: FieldError[];
}
