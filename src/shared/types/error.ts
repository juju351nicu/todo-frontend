/** Backendの入力項目エラー。 */
export interface FieldError {
  errorCode?: string;
  field: string;
  message: string;
  rejectedValue?: unknown;
}

/** Backendの共通エラーレスポンス。 */
export interface ErrorResponse {
  fieldErrors?: FieldError[];
}
