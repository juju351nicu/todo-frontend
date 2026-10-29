import { ref } from "vue";

import type { TaskBoard, TaskCard } from "@/features/project/types/project";
import ProjectTaskApi, { ProjectTaskApiError } from "@/features/task/api/projectTaskApi";
import type { TaskBoardPageContext } from "@/features/task/composables/taskBoardPageContext";
import type { TaskBoardPermissions } from "@/features/task/composables/useTaskBoardPermissions";
import { DISPLAY_MESSAGES } from "@/shared/constants/displayMessages";
import { focusFirstEnabledElement } from "@/shared/utils/focus";

/** vuedraggableの`change` eventが運ぶ、移動したTaskとその位置。 */
interface TaskDragChangeDetail {
  element: TaskCard;
  newIndex: number;
}

/** vuedraggableの`change` event。移動先の列では`added`、同じ列の中では`moved`、移動元の列では`removed`になる。 */
interface TaskDragChangeEvent {
  added?: TaskDragChangeDetail;
  moved?: TaskDragChangeDetail;
  removed?: TaskDragChangeDetail;
}

/** キーボードから指定できるTaskの移動方向。 */
export type TaskMoveDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

/** ドラッグ失敗時に復元できるよう、Boardと列・Task配列を複製する。 */
const cloneTaskBoard = (source: TaskBoard): TaskBoard => ({
  ...source,
  columns: source.columns.map((column) => ({
    ...column,
    tasks: column.tasks.map((task) => ({ ...task })),
  })),
});

/**
 * Board上のTaskの移動（dragとキーボード）を扱う。
 *
 * - dragでは、vuedraggableが先に表示を並べ替える（楽観表示）。API失敗時はドラッグ前のBoardへ戻す。
 * - キーボードでは、上下は同じ列で1件、左右は隣の列の末尾へ動かし、dragと同じ移動APIを呼ぶ。
 * - 409競合では、最新Boardを取り直して再操作を促す（`context.reloadBoardAfterConflict`）。
 *
 * @param context Board画面の共通の状態と操作
 * @param permissions Project単位の操作の可否（`canMoveTask`を使う）
 */
export const useTaskBoardMove = (
  context: TaskBoardPageContext,
  permissions: Pick<TaskBoardPermissions, "canMoveTask">
) => {
  const { board, errorMessages, projectId, successMessage } = context;
  const { canMoveTask } = permissions;

  /** ドラッグ前のBoard。drag中にAPIが失敗したとき、楽観表示を戻すために使う。 */
  const dragSnapshot = ref<TaskBoard | null>(null);
  const isMoving = ref(false);

  /** ドラッグ前のBoardを退避し、API失敗時に表示順を戻せるようにする。 */
  const startTaskDrag = (): void => {
    if (!canMoveTask.value || isMoving.value || board.value === null) {
      return;
    }
    dragSnapshot.value = cloneTaskBoard(board.value);
    errorMessages.value = [];
    successMessage.value = "";
  };

  /** 移動が発生しなかったドラッグ操作では不要になった退避状態を破棄する。 */
  const finishTaskDrag = (): void => {
    if (!isMoving.value) {
      dragSnapshot.value = null;
    }
  };

  /** 退避したドラッグ前のBoardを捨てる（画面を片付けるとき）。 */
  const discardDragSnapshot = (): void => {
    dragSnapshot.value = null;
  };

  /** 指定されたBoardを複製して復元し、失敗した楽観表示を残さない。 */
  const restoreBoardSnapshot = (snapshot: TaskBoard | null): void => {
    if (snapshot !== null) {
      board.value = cloneTaskBoard(snapshot);
    }
  };

  /**
   * dragとkeyboardで共通のTask移動APIを実行し、失敗時の復元と競合回復を行う。
   *
   * @param movedTask 移動対象Task
   * @param destinationStatusId 移動先列ID
   * @param previousTask 移動後に直前となるTask
   * @param nextTask 移動後に直後となるTask
   * @param snapshot API失敗時に復元する移動前Board
   */
  const executeTaskMove = async (
    movedTask: TaskCard,
    destinationStatusId: number,
    previousTask: TaskCard | null,
    nextTask: TaskCard | null,
    snapshot: TaskBoard | null
  ): Promise<void> => {
    if (
      !canMoveTask.value ||
      isMoving.value ||
      projectId.value === null ||
      board.value === null
    ) {
      restoreBoardSnapshot(snapshot);
      return;
    }

    isMoving.value = true;
    errorMessages.value = [];
    successMessage.value = "";
    try {
      board.value = await ProjectTaskApi.moveTask(
        projectId.value,
        movedTask.taskId,
        {
          destinationStatusId,
          previousTaskId: previousTask?.taskId ?? null,
          nextTaskId: nextTask?.taskId ?? null,
          version: movedTask.version,
        }
      );
      successMessage.value = "Taskを移動しました。";
    } catch (error: unknown) {
      restoreBoardSnapshot(snapshot);
      await context.handleApiError(error, DISPLAY_MESSAGES.task.board.moveFailed);
      if (error instanceof ProjectTaskApiError && error.status === 409) {
        await context.reloadBoardAfterConflict();
      }
    } finally {
      isMoving.value = false;
      dragSnapshot.value = null;
    }
  };

  /**
   * vuedraggableが反映した移動順から前後Taskを解決し、専用APIで位置を確定する。
   * source列のremoved eventは無視し、destination列のaddedまたは同一列のmovedだけを送信する。
   */
  const handleTaskDrop = async (
    event: TaskDragChangeEvent,
    destinationStatusId: number
  ): Promise<void> => {
    const change = event.added ?? event.moved;
    if (change === undefined) {
      return;
    }
    if (
      !canMoveTask.value ||
      isMoving.value ||
      projectId.value === null ||
      board.value === null
    ) {
      restoreBoardSnapshot(dragSnapshot.value);
      return;
    }
    const destinationColumn = board.value.columns.find(
      (column) => column.taskStatusId === destinationStatusId
    );
    const movedTaskIndex = destinationColumn?.tasks.findIndex(
      (task) => task.taskId === change.element.taskId
    );
    if (
      destinationColumn === undefined ||
      movedTaskIndex === undefined ||
      movedTaskIndex < 0
    ) {
      restoreBoardSnapshot(dragSnapshot.value);
      errorMessages.value = ["Taskの移動先を特定できませんでした。"];
      return;
    }

    const previousTask = destinationColumn.tasks[movedTaskIndex - 1] ?? null;
    const nextTask = destinationColumn.tasks[movedTaskIndex + 1] ?? null;
    await executeTaskMove(
      change.element,
      destinationStatusId,
      previousTask,
      nextTask,
      dragSnapshot.value
    );
  };

  /**
   * キーボード移動の後（失敗して元へ戻した場合も含む）、移動したTaskの移動アイコンへフォーカスを戻す。
   * 移動中はアイコンをdisabledにするためフォーカスが外れ、続けて方向キーで動かせなくなるため。
   * 移動したTaskはBoardの再描画で別の要素になるので、`data-task-move-handle`属性で探し直す。
   *
   * @param taskId 移動したTask ID
   */
  const restoreMoveHandleFocus = (taskId: number): Promise<void> =>
    focusFirstEnabledElement([`[data-task-move-handle="${taskId}"]`]);

  /**
   * 方向キーから移動先と前後Taskを解決し、dragと同じ移動処理を実行する。
   * 上下は同じ列で1件移動し、左右は隣接列の末尾へ移動する。
   *
   * @param taskId 移動対象Task ID
   * @param direction 移動方向
   */
  const moveTaskByKeyboard = async (
    taskId: number,
    direction: TaskMoveDirection
  ): Promise<void> => {
    if (!canMoveTask.value || isMoving.value || board.value === null) {
      return;
    }

    const sourceColumnIndex = board.value.columns.findIndex((column) =>
      column.tasks.some((task) => task.taskId === taskId)
    );
    const sourceColumn = board.value.columns[sourceColumnIndex];
    const sourceTaskIndex = sourceColumn?.tasks.findIndex(
      (task) => task.taskId === taskId
    );
    if (
      sourceColumn === undefined ||
      sourceTaskIndex === undefined ||
      sourceTaskIndex < 0
    ) {
      errorMessages.value = ["Taskの現在位置を特定できませんでした。"];
      return;
    }

    const movedTask = sourceColumn.tasks[sourceTaskIndex];
    const isVertical = direction === "UP" || direction === "DOWN";
    const destinationColumnIndex = isVertical
      ? sourceColumnIndex
      : sourceColumnIndex + (direction === "LEFT" ? -1 : 1);
    const destinationColumn = board.value.columns[destinationColumnIndex];
    if (movedTask === undefined || destinationColumn === undefined) {
      return;
    }

    const destinationTasks = [...destinationColumn.tasks];
    let destinationTaskIndex: number;
    if (isVertical) {
      destinationTaskIndex =
        sourceTaskIndex + (direction === "UP" ? -1 : 1);
      if (
        destinationTaskIndex < 0 ||
        destinationTaskIndex >= sourceColumn.tasks.length
      ) {
        return;
      }
      destinationTasks.splice(sourceTaskIndex, 1);
      destinationTasks.splice(destinationTaskIndex, 0, movedTask);
    } else {
      destinationTaskIndex = destinationTasks.length;
      destinationTasks.push(movedTask);
    }

    const snapshot = cloneTaskBoard(board.value);
    await executeTaskMove(
      movedTask,
      destinationColumn.taskStatusId,
      destinationTasks[destinationTaskIndex - 1] ?? null,
      destinationTasks[destinationTaskIndex + 1] ?? null,
      snapshot
    );
    await restoreMoveHandleFocus(taskId);
  };

  return {
    discardDragSnapshot,
    finishTaskDrag,
    handleTaskDrop,
    isMoving,
    moveTaskByKeyboard,
    startTaskDrag,
  };
};
