import type {
  WbsTask,
  WbsTaskPriority,
  WbsTaskType,
  WbsTreeRow,
} from "@/features/wbs/types/wbs";

interface MutableWbsNode {
  task: WbsTask;
  children: MutableWbsNode[];
}

/** 同じ親配下のTaskをBackendのposition、Task IDの順に並べる。 */
const compareNodes = (left: MutableWbsNode, right: MutableWbsNode): number =>
  left.task.position - right.task.position || left.task.taskId - right.task.taskId;

/**
 * Backendのflat listを、親Taskの直後に子孫が続く階層表用の行へ変換する。
 * 親が欠けたTaskと循環したTaskも先頭階層として1回だけ表示し、データ不整合で行を消さない。
 *
 * @param tasks WBS APIが返したProject内Task
 * @returns 深さと子Task有無を付けたpreorderの新しい配列
 */
export const buildWbsTreeRows = (tasks: readonly WbsTask[]): WbsTreeRow[] => {
  const nodesById = new Map<number, MutableWbsNode>();
  tasks.forEach((task) => {
    if (!nodesById.has(task.taskId)) {
      nodesById.set(task.taskId, { task, children: [] });
    }
  });

  const roots: MutableWbsNode[] = [];
  nodesById.forEach((node) => {
    const parentId = node.task.parentTaskId;
    const parent = parentId === null ? undefined : nodesById.get(parentId);
    if (parent === undefined || parent === node) {
      roots.push(node);
      return;
    }
    parent.children.push(node);
  });

  roots.sort(compareNodes);
  nodesById.forEach((node) => node.children.sort(compareNodes));

  const rows: WbsTreeRow[] = [];
  const visited = new Set<number>();
  const appendNode = (node: MutableWbsNode, depth: number): void => {
    if (visited.has(node.task.taskId)) {
      return;
    }
    // 訪問時点で確定済みにし、循環参照でも再帰を停止して各Taskを1回だけ表示する。
    visited.add(node.task.taskId);
    rows.push({
      ...node.task,
      depth,
      hasChildren: node.children.length > 0,
    });
    node.children.forEach((child) => appendNode(child, depth + 1));
  };

  roots.forEach((root) => appendNode(root, 0));
  [...nodesById.values()]
    .sort(compareNodes)
    .forEach((node) => appendNode(node, 0));
  return rows;
};

/** 分単位の予定工数を、時間と分を省略しない日本語表示へ変換する。 */
export const formatPlannedEffort = (minutes: number): string => {
  if (!Number.isSafeInteger(minutes) || minutes < 0) {
    return "—";
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `${remainingMinutes}分`;
  }
  return remainingMinutes === 0
    ? `${hours}時間`
    : `${hours}時間${remainingMinutes}分`;
};

/** API外部入力の進捗率をProgress Barで扱える0から100へ制限する。 */
export const normalizeProgressPercent = (progressPercent: number): number => {
  if (!Number.isFinite(progressPercent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, progressPercent));
};

/** 進捗率を小数第2位までの百分率表示へ変換する。 */
export const formatProgressPercent = (progressPercent: number): string => {
  const normalized = normalizeProgressPercent(progressPercent);
  return normalized.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
};

/** BackendのTask種別コードをWBS階層表の日本語表示へ変換する。 */
export const getWbsTaskTypeLabel = (taskType: WbsTaskType): string =>
  ({ TASK: "Task", SUMMARY: "Summary", MILESTONE: "Milestone" })[taskType];

/** BackendのTask種別コードをWBS階層表のMaterial Design Iconへ変換する。 */
export const getWbsTaskTypeIcon = (taskType: WbsTaskType): string =>
  ({
    TASK: "mdi-checkbox-blank-circle-outline",
    SUMMARY: "mdi-folder-outline",
    MILESTONE: "mdi-diamond-outline",
  })[taskType];

/** Task優先度をWBS階層表の日本語表示へ変換する。 */
export const getWbsPriorityLabel = (priority: WbsTaskPriority): string =>
  ({ 1: "高", 2: "中", 3: "低" })[priority];

/** Task優先度をVuetify colorへ変換する。 */
export const getWbsPriorityColor = (priority: WbsTaskPriority): string =>
  ({ 1: "error", 2: "warning", 3: "info" })[priority];
