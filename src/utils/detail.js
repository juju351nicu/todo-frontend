const EMPTY_MEMBER_FORM = Object.freeze({
  memberId: 0,
  lastName: "",
  firstName: "",
  loginId: "",
  password: "",
  email: "",
  role: 2,
  version: 0,
});

const EMPTY_TODO_FORM = Object.freeze({
  todoId: 0,
  dateFrom: "",
  dateTo: "",
  title: "",
  detail: "",
  userId: 1,
  doneFlag: 0,
  priority: 3,
  version: 0,
  idMemberMap: {},
  userList: [],
});

/**
 * 会員詳細APIのレスポンスを編集フォームへ変換する。
 * パスワードはAPIから受け取らず、変更時にだけ入力する。
 *
 * @param {Object} detail 会員詳細APIレスポンス
 * @returns {Object} 会員編集フォーム
 */
export const createMemberDetailForm = (detail = {}) => ({
  ...EMPTY_MEMBER_FORM,
  memberId: Number(detail.memberId ?? EMPTY_MEMBER_FORM.memberId),
  lastName: detail.lastName ?? EMPTY_MEMBER_FORM.lastName,
  firstName: detail.firstName ?? EMPTY_MEMBER_FORM.firstName,
  loginId: detail.loginId ?? EMPTY_MEMBER_FORM.loginId,
  email: detail.email ?? EMPTY_MEMBER_FORM.email,
  role: Number(detail.role ?? EMPTY_MEMBER_FORM.role),
  version: Number(detail.version ?? EMPTY_MEMBER_FORM.version),
});

/**
 * Todo詳細APIのsnake_caseレスポンスを編集フォームへ変換する。
 *
 * @param {Object} detail Todo詳細APIレスポンス
 * @returns {Object} Todo編集フォーム
 */
export const createTodoDetailForm = (detail = {}) => ({
  ...EMPTY_TODO_FORM,
  todoId: Number(detail.todo_id ?? EMPTY_TODO_FORM.todoId),
  dateFrom: detail.date_from ?? EMPTY_TODO_FORM.dateFrom,
  dateTo: detail.date_to ?? EMPTY_TODO_FORM.dateTo,
  title: detail.title ?? EMPTY_TODO_FORM.title,
  detail: detail.detail ?? EMPTY_TODO_FORM.detail,
  userId: Number(detail.user_id ?? EMPTY_TODO_FORM.userId),
  doneFlag: Number(detail.done_flag ?? EMPTY_TODO_FORM.doneFlag),
  priority: Number(detail.priority ?? EMPTY_TODO_FORM.priority),
  version: Number(detail.version ?? EMPTY_TODO_FORM.version),
});
