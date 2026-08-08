/** Backendの入力項目エラー。 */
export interface FieldError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

/** Backendの共通エラーレスポンス。 */
export interface ErrorResponse {
  fieldErrors?: FieldError[];
}
