import type {
  TaskDependency,
  TaskDependencyCreateForm,
  TaskDependencyCreateRequest,
  TaskDependencyRow,
  TaskDependencyTaskOption,
  WbsTask,
} from "@/features/wbs/types/wbs";

/**
 * 依存関係のselect候補と一覧に表示するTask名を作る。
 * WBSコードがある場合だけ、階層表と同じ番号で探せるよう前置する。
 *
 * @param task WBS APIが返したTask
 * @returns `"1.1 実装"`または`"実装"`の形式の表示名
 */
export const buildDependencyTaskLabel = (task: Readonly<WbsTask>): string =>
  task.wbsCode === null || task.wbsCode.trim() === ""
    ? task.title
    : `${task.wbsCode} ${task.title}`;

/**
 * 依存関係の端点に選べるTaskの候補を、階層表と同じ並びで作る。
 *
 * @param tasks 階層表の行順に並んだTask
 * @returns WBSコード付き表示名とTask IDの組
 */
export const buildDependencyTaskOptions = (
  tasks: readonly WbsTask[]
): TaskDependencyTaskOption[] =>
  tasks.map((task) => ({
    title: buildDependencyTaskLabel(task),
    value: task.taskId,
  }));

/**
 * 現在の利用者が、依存関係の端点（先行・後続）としてこのTaskを追加・削除に使えるか判定する。
 *
 * Backendの`TaskResourceAuthorizationLogic.checkCanUpdate`と同じ条件にそろえ、
 * Project管理権限（SYSTEM_ADMIN・OWNER・MANAGER）があれば全Task、なければ担当者が本人のTaskだけを許可する。
 * 画面で操作できない候補やボタンを出さないための判定で、最終判定はBackendが行う。
 *
 * @param task 判定するTask。WBSに表示していないTaskはundefined
 * @param currentAccountId ログイン中のアカウントID。未取得ならnull
 * @param canManageAnyTask Project管理権限があるか
 * @returns 端点として使える場合はtrue
 */
export const canChangeDependencyEndpoint = (
  task: Readonly<Pick<WbsTask, "assigneeAccountId">> | undefined,
  currentAccountId: number | null,
  canManageAnyTask: boolean
): boolean =>
  canManageAnyTask ||
  (task !== undefined &&
    currentAccountId !== null &&
    task.assigneeAccountId === currentAccountId);

/**
 * 依存関係一覧の各行へ、先行・後続Taskの表示名と削除できるかを付ける。
 * 権限やarchiveでWBSに表示されないTaskの端点も行を消さず、Task IDで示す。
 *
 * @param dependencies Backendが返したProject内の依存関係
 * @param taskOptions 現在WBSに表示している全Taskの候補（表示名の引き当てに使う）
 * @param canChangeTaskId 端点のTaskを変更できるか。両端とも変更できる行だけ削除可能とする
 * @returns 表示名付きの新しい配列。Backendの並びを保つ
 */
export const buildDependencyRows = (
  dependencies: readonly TaskDependency[],
  taskOptions: readonly TaskDependencyTaskOption[],
  canChangeTaskId: (taskId: number) => boolean
): TaskDependencyRow[] => {
  const labelByTaskId = new Map(
    taskOptions.map((option) => [option.value, option.title])
  );
  return dependencies.map((dependency) => ({
    ...dependency,
    predecessorLabel:
      labelByTaskId.get(dependency.predecessorTaskId) ??
      `Task ID: ${dependency.predecessorTaskId}（表示対象外）`,
    successorLabel:
      labelByTaskId.get(dependency.successorTaskId) ??
      `Task ID: ${dependency.successorTaskId}（表示対象外）`,
    canDelete:
      canChangeTaskId(dependency.predecessorTaskId) &&
      canChangeTaskId(dependency.successorTaskId),
  }));
};

/** 依存関係追加Formの検証結果。正常時はRequestだけ、入力不正時はmessageだけを持つ。 */
export type TaskDependencyCreateRequestResult =
  | { request: TaskDependencyCreateRequest; messages: [] }
  | { request: null; messages: string[] };

/**
 * 依存関係追加Formを検証し、Backendへ送信できるFinish-to-Start Requestへ変換する。
 * graph全体の循環、Project状態、最新Task状態はBackendを最終判定とし、ここでは入力と重複だけを検証する。
 *
 * @param form Dialogから受け取った未検証入力
 * @param availableTaskIds 端点に選べる（現在WBSに表示している）Task ID
 * @param existingDependencies 取得済みの依存関係。同じ向きの重複登録を防ぐ
 * @returns 正常時はRequest、入力不正時は表示順の利用者向けmessage一覧
 */
export const buildTaskDependencyCreateRequest = (
  form: Readonly<TaskDependencyCreateForm>,
  availableTaskIds: ReadonlySet<number>,
  existingDependencies: readonly TaskDependency[]
): TaskDependencyCreateRequestResult => {
  const messages: string[] = [];
  const { predecessorTaskId, successorTaskId, lagMinutes } = form;

  if (!isSelectableTaskId(predecessorTaskId, availableTaskIds)) {
    messages.push("先行Taskを選択してください。");
  }
  if (!isSelectableTaskId(successorTaskId, availableTaskIds)) {
    messages.push("後続Taskを選択してください。");
  }
  if (
    predecessorTaskId !== null &&
    successorTaskId !== null &&
    predecessorTaskId === successorTaskId
  ) {
    messages.push("先行Taskと後続Taskには別のTaskを選択してください。");
  }
  if (
    lagMinutes === null ||
    !Number.isSafeInteger(lagMinutes) ||
    lagMinutes < 0
  ) {
    messages.push("待ち時間は0以上の整数で入力してください。");
  }
  if (
    predecessorTaskId !== null &&
    successorTaskId !== null &&
    existingDependencies.some(
      (dependency) =>
        dependency.predecessorTaskId === predecessorTaskId &&
        dependency.successorTaskId === successorTaskId
    )
  ) {
    messages.push("同じ向きのTask依存関係はすでに登録されています。");
  }
  if (
    messages.length > 0 ||
    predecessorTaskId === null ||
    successorTaskId === null ||
    lagMinutes === null
  ) {
    return { request: null, messages };
  }
  return {
    request: {
      predecessorTaskId,
      successorTaskId,
      dependencyType: "FINISH_TO_START",
      lagMinutes,
    },
    messages: [],
  };
};

/** 正の安全な整数で、かつ現在WBSに表示しているTaskのIDか判定する。 */
const isSelectableTaskId = (
  taskId: number | null,
  availableTaskIds: ReadonlySet<number>
): taskId is number =>
  taskId !== null &&
  Number.isSafeInteger(taskId) &&
  taskId > 0 &&
  availableTaskIds.has(taskId);
