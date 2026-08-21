/** WBS上でのTask構造種別。BackendのTaskTypeコードと一致する。 */
export type WbsTaskType = "TASK" | "SUMMARY" | "MILESTONE";

/** WBS Taskの優先度。数字が小さいほど優先度が高い。 */
export type WbsTaskPriority = 1 | 2 | 3;

/**
 * Boardと同じTask IDを使用するWBS参照APIの1行。
 * 日付はISO local date、予定工数は分、進捗率は0から100で受け取る。
 */
export interface WbsTask {
  /** Boardと共通のTask ID。 */
  taskId: number;
  /** 親Task ID。最上位Taskはnull。 */
  parentTaskId: number | null;
  /** 通常Task、summary、milestoneの構造種別。 */
  taskType: WbsTaskType;
  /** 主キーとは分離した画面表示用コード。未設定時はnull。 */
  wbsCode: string | null;
  /** Taskタイトル。 */
  title: string;
  /** Taskの詳細説明。 */
  detail: string;
  /** 予定開始日。yyyy-MM-dd形式。 */
  plannedStartDate: string;
  /** 予定終了日。yyyy-MM-dd形式。 */
  plannedEndDate: string;
  /** 分単位の予定工数。 */
  plannedEffortMinutes: number;
  /** 0から100の進捗率。 */
  progressPercent: number;
  /** 担当アカウントID。 */
  assigneeAccountId: number;
  /** Task優先度。 */
  priority: WbsTaskPriority;
  /** 所属Board列ID。 */
  taskStatusId: number;
  /** Project内で変更しないBoard列コード。 */
  taskStatusCode: string;
  /** Board列の画面表示名。 */
  taskStatusName: string;
  /** 同じ親配下の初期表示順。 */
  position: number;
  /** 将来の編集APIで使用する楽観ロックversion。 */
  version: number;
}

/** Project単位の読取り専用WBS API Response。 */
export interface WbsResponse {
  /** WBSを所有するProject ID。 */
  projectId: number;
  /** Projectの画面表示名。 */
  projectName: string;
  /** 親Task IDを持つflat list。Taskがない場合は空配列。 */
  tasks: WbsTask[];
}

/** flat listを階層表へ表示するために深さと子Task有無を加えた行。 */
export interface WbsTreeRow extends WbsTask {
  /** 最上位を0とする階層の深さ。 */
  depth: number;
  /** 直接の子Taskを1件以上持つ場合はtrue。 */
  hasChildren: boolean;
}
