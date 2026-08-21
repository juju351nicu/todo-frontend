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

/** WBS画面で切り替える読取り専用の表示形式。 */
export type WbsViewMode = "table" | "gantt";

/** DHTMLX Ganttへ渡すTask。Backend DTOをlibrary固有形式へ直接流さないため分離する。 */
export interface WbsGanttTask {
  /** Board・WBSと共通のTask ID。 */
  id: number;
  /** Gantt左側のtreeへ表示するWBSコード付きタイトル。 */
  text: string;
  /** Gantt内で循環しないよう階層行から再構成した親Task ID。最上位は0。 */
  parent: number;
  /** 通常Task、summary、milestoneに対応するDHTMLXのTask種別。 */
  type: "task" | "project" | "milestone";
  /** yyyy-MM-dd形式の予定開始日。不正日付の場合は省略する。 */
  start_date?: string;
  /** yyyy-MM-dd形式の終了境界。不正日付の場合は省略する。 */
  end_date?: string;
  /** 0から1へ正規化した進捗率。 */
  progress: number;
  /** 初期表示で子Taskを展開するか。 */
  open: boolean;
  /** 日付不正時にtimelineへbarを表示しないための指定。 */
  unscheduled?: boolean;
  /** 読取り専用MVPでTask個別編集も無効にする。 */
  readonly: true;
}

/** WBS階層行をDHTMLX Ganttへ安全に渡す変換結果。 */
export interface WbsGanttData {
  /** Ganttのtreeとtimelineへ描画するTask。 */
  tasks: WbsGanttTask[];
  /** 不正な予定日でtimelineへbarを描画できなかったTask ID。 */
  unscheduledTaskIds: number[];
  /** 描画対象全体の最初の日。予定日が全件不正の場合はnull。 */
  rangeStart: Date | null;
  /** 描画対象全体の終了境界。予定日が全件不正の場合はnull。 */
  rangeEnd: Date | null;
}
