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
  /** WBS Task更新APIで使用する楽観ロックversion。 */
  version: number;
}

/** Project単位のWBS参照・更新API Response。 */
export interface WbsResponse {
  /** WBSを所有するProject ID。 */
  projectId: number;
  /** Projectの画面表示名。 */
  projectName: string;
  /** 親Task IDを持つflat list。Taskがない場合は空配列。 */
  tasks: WbsTask[];
}

/** WBS Task間の日程依存種別。初期契約ではFinish-to-Startだけを使用する。 */
export type TaskDependencyType = "FINISH_TO_START";

/** BackendがProject単位で返す、有効Task間の依存関係。 */
export interface TaskDependency {
  /** Task依存関係を一意に識別するID。 */
  dependencyId: number;
  /** 先に完了するTask ID。 */
  predecessorTaskId: number;
  /** 後から開始するTask ID。 */
  successorTaskId: number;
  /** 日程依存種別。 */
  dependencyType: TaskDependencyType;
  /** 先行Task終了から後続Task開始までの待ち時間（分）。 */
  lagMinutes: number;
  /** 削除時に送る楽観ロックversion。 */
  version: number;
}

/** Project単位のTask依存関係一覧API Response。 */
export interface TaskDependencyListResponse {
  /** 依存関係を所有するProject ID。 */
  projectId: number;
  /** Task依存関係ID順の有効な依存関係。 */
  dependencies: TaskDependency[];
}

/** Task依存関係作成APIへ送る検証済みRequest。 */
export interface TaskDependencyCreateRequest {
  /** 先に完了するTask ID。 */
  predecessorTaskId: number;
  /** 後から開始するTask ID。 */
  successorTaskId: number;
  /** 初期契約で固定するFinish-to-Start。 */
  dependencyType: TaskDependencyType;
  /** 0以上の分単位待ち時間。 */
  lagMinutes: number;
}

/** Task依存関係追加Dialogが保持する未検証の入力値。 */
export interface TaskDependencyCreateForm {
  /** 先行Task未選択時はnull。 */
  predecessorTaskId: number | null;
  /** 後続Task未選択時はnull。 */
  successorTaskId: number | null;
  /** 未入力または数値変換できない場合はnull。 */
  lagMinutes: number | null;
}

/** Task依存関係のselectへ表示するTask候補。 */
export interface TaskDependencyTaskOption {
  /** WBSコードとTask名を含む表示文字列。 */
  title: string;
  /** Board・WBSと共通のTask ID。 */
  value: number;
}

/** Task依存関係一覧へTask名を加えた画面表示行。 */
export interface TaskDependencyRow extends TaskDependency {
  /** 先行TaskのWBSコード付き表示名。 */
  predecessorLabel: string;
  /** 後続TaskのWBSコード付き表示名。 */
  successorLabel: string;
}

/** Taskへ計上された1作業者・1業務日単位の実績工数。 */
export interface TaskWorkLog {
  /** Task日別実績工数ID。 */
  workLogId: number;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** 実績を計上した業務日。yyyy-MM-dd形式。 */
  workDate: string;
  /** 分単位の実績工数。 */
  actualEffortMinutes: number;
  /** 実際に作業したProject memberのアカウントID。 */
  workerAccountId: number;
  /** 姓名、メール、アカウントIDの順に補完された作業者表示名。 */
  workerDisplayName: string;
  /** 実績を最初に登録した認証済みアカウントID。 */
  createdBy: number;
  /** ISO-8601形式の作成時刻。 */
  createdAt: string;
  /** 実績を最後に更新した認証済みアカウントID。 */
  updatedBy: number;
  /** ISO-8601形式の最終更新時刻。 */
  updatedAt: string;
  /** 更新・削除時に送る楽観ロックversion。 */
  version: number;
}

/** 1 Taskの日別実績と合計工数を返すAPI Response。 */
export interface TaskWorkLogListResponse {
  /** 実績工数を所有するProject ID。 */
  projectId: number;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** 取得した日別実績の合計工数（分）。 */
  totalActualEffortMinutes: number;
  /** 業務日、作業者、実績ID順の日別実績。 */
  workLogs: TaskWorkLog[];
}

/** Task日別実績の登録APIへ送信する検証済みRequest。 */
export interface TaskWorkLogCreateRequest {
  /** 実績を計上する業務日。yyyy-MM-dd形式。 */
  workDate: string;
  /** 1分以上1440分以下の実績工数。 */
  actualEffortMinutes: number;
  /** 作業を実施したProject memberのアカウントID。 */
  workerAccountId: number;
}

/** Task日別実績の更新APIへ送信する検証済みRequest。 */
export interface TaskWorkLogUpdateRequest extends TaskWorkLogCreateRequest {
  /** 一覧取得時点の楽観ロックversion。 */
  version: number;
}

/** Task日別実績Dialogが保持する、Backend型へ変換する前の入力値。 */
export interface TaskWorkLogForm {
  /** 実績を計上する業務日。未入力時は空文字。 */
  workDate: string;
  /** 分単位の実績工数。未入力または数値変換できない場合はnull。 */
  actualEffortMinutes: number | null;
  /** 作業者未選択時はnull。 */
  workerAccountId: number | null;
}

/** Task日別実績の作業者selectへ表示するProject member候補。 */
export interface TaskWorkLogWorkerOption {
  /** アカウントIDとProject roleを含む表示文字列。 */
  title: string;
  /** 作業者となるProject memberのアカウントID。 */
  value: number;
}

/** Task全体予定を1予定担当者・1業務日へ配賦した日別予定工数。 */
export interface TaskEffortPlan {
  /** Task日別予定工数ID。 */
  effortPlanId: number;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** 予定工数を配賦した業務日。yyyy-MM-dd形式。 */
  planDate: string;
  /** 分単位の日別予定工数。 */
  plannedEffortMinutes: number;
  /** 予定工数を割り当てたProject memberのアカウントID。 */
  assigneeAccountId: number;
  /** 姓名、メール、アカウントIDの順に補完された予定担当者表示名。 */
  assigneeDisplayName: string;
  /** 日別予定を最初に登録した認証済みアカウントID。 */
  createdBy: number;
  /** ISO-8601形式の作成時刻。 */
  createdAt: string;
  /** 日別予定を最後に更新した認証済みアカウントID。 */
  updatedBy: number;
  /** ISO-8601形式の最終更新時刻。 */
  updatedAt: string;
  /** 更新・削除時に送る楽観ロックversion。 */
  version: number;
}

/** 1 Taskの日別予定、Task全体予定、配賦状況を返すAPI Response。 */
export interface TaskEffortPlanListResponse {
  /** 日別予定工数を所有するProject ID。 */
  projectId: number;
  /** Board・WBSと共通のTask ID。 */
  taskId: number;
  /** Task本体へ設定した全体予定工数（分）。 */
  taskPlannedEffortMinutes: number;
  /** 取得した日別予定工数の合計（分）。 */
  totalDailyPlannedEffortMinutes: number;
  /** 全体予定から日別予定合計を引いた未配賦工数。負数は過配賦。 */
  unallocatedEffortMinutes: number;
  /** 予定日、予定担当者、予定工数ID順の日別予定。 */
  effortPlans: TaskEffortPlan[];
}

/** Task日別予定の登録APIへ送信する検証済みRequest。 */
export interface TaskEffortPlanCreateRequest {
  /** 予定工数を配賦する業務日。yyyy-MM-dd形式。 */
  planDate: string;
  /** 1分以上1440分以下の日別予定工数。 */
  plannedEffortMinutes: number;
  /** 予定担当者となるProject memberのアカウントID。 */
  assigneeAccountId: number;
}

/** Task日別予定の更新APIへ送信する検証済みRequest。 */
export interface TaskEffortPlanUpdateRequest
  extends TaskEffortPlanCreateRequest {
  /** 一覧取得時点の楽観ロックversion。 */
  version: number;
}

/** Task日別予定Dialogが保持する、Backend型へ変換する前の入力値。 */
export interface TaskEffortPlanForm {
  /** 予定工数を配賦する業務日。未入力時は空文字。 */
  planDate: string;
  /** 分単位の日別予定工数。未入力または数値変換できない場合はnull。 */
  plannedEffortMinutes: number | null;
  /** 予定担当者未選択時はnull。 */
  assigneeAccountId: number | null;
}

/** Task日別予定の予定担当者selectへ表示するProject member候補。 */
export interface TaskEffortPlanAssigneeOption {
  /** アカウントIDとProject roleを含む表示文字列。 */
  title: string;
  /** 予定担当者となるProject memberのアカウントID。 */
  value: number;
}

/** Project workloadの日付・担当者単位の予定実績比較行。 */
export interface TaskWorkloadRow {
  /** 予定または実績を集計した業務日。yyyy-MM-dd形式。 */
  workDate: string;
  /** 予定担当者または実績作業者のアカウントID。 */
  accountId: number;
  /** 姓名、メール、アカウントIDの順に補完された担当者表示名。 */
  accountDisplayName: string;
  /** 日付・担当者単位の予定工数合計（分）。 */
  plannedEffortMinutes: number;
  /** 日付・担当者単位の実績工数合計（分）。 */
  actualEffortMinutes: number;
  /** 実績から予定を引いた差分。正数は予定超過、負数は予定未消化。 */
  varianceEffortMinutes: number;
}

/** Project内の指定期間における担当者別workload API Response。 */
export interface TaskWorkloadResponse {
  /** workloadを所有するProject ID。 */
  projectId: number;
  /** 集計開始日。境界を含む。 */
  dateFrom: string;
  /** 集計終了日。境界を含む。 */
  dateTo: string;
  /** 期間内の日別予定工数合計（分）。 */
  totalPlannedEffortMinutes: number;
  /** 期間内の日別実績工数合計（分）。 */
  totalActualEffortMinutes: number;
  /** 期間内実績から予定を引いた差分（分）。 */
  totalVarianceEffortMinutes: number;
  /** 業務日、アカウントID順の担当者別workload。 */
  workloads: TaskWorkloadRow[];
}

/** workload検索欄が保持する開始日・終了日。 */
export interface TaskWorkloadDateRange {
  /** 集計開始日。yyyy-MM-dd形式。 */
  dateFrom: string;
  /** 集計終了日。yyyy-MM-dd形式。 */
  dateTo: string;
}

/** WBS Task編集Dialogが保持する、Backend型へ変換する前の入力値。 */
export interface WbsTaskEditForm {
  /** 親Task ID。最上位へ移動する場合はnull。 */
  parentTaskId: number | null;
  /** 通常Task、summary、milestoneの構造種別。 */
  taskType: WbsTaskType;
  /** 画面表示用WBSコード。空欄は保存時にnullへ変換する。 */
  wbsCode: string;
  /** 予定開始日。yyyy-MM-dd形式。 */
  plannedStartDate: string;
  /** 予定終了日。yyyy-MM-dd形式。 */
  plannedEndDate: string;
  /** 分単位の予定工数。未入力または不正入力はnull。 */
  plannedEffortMinutes: number | null;
  /** 0から100までの進捗率。未入力または不正入力はnull。 */
  progressPercent: number | null;
  /** Dialogを開いたWBS取得時点の楽観ロックversion。 */
  version: number;
}

/** WBS Task更新APIへ送信する、検証・正規化済みRequest。 */
export interface WbsTaskUpdateRequest {
  /** 更新後の親Task ID。最上位へ移動する場合はnull。 */
  parentTaskId: number | null;
  /** 更新後のTask構造種別。 */
  taskType: WbsTaskType;
  /** 正規化済みWBSコード。空欄はnull。 */
  wbsCode: string | null;
  /** 更新後の予定開始日。 */
  plannedStartDate: string;
  /** 更新後の予定終了日。 */
  plannedEndDate: string;
  /** 更新後の分単位予定工数。 */
  plannedEffortMinutes: number;
  /** 更新後の0から100までの進捗率。 */
  progressPercent: number;
  /** 更新対象を取得した時点の楽観ロックversion。 */
  version: number;
}

/** 親Task selectへ表示するsummary Taskまたは最上位の候補。 */
export interface WbsParentOption {
  /** WBSコードを含む利用者向け表示名。 */
  title: string;
  /** 親Task ID。最上位を選ぶ場合はnull。 */
  value: number | null;
}

/** flat listを階層表へ表示するために深さと子Task有無を加えた行。 */
export interface WbsTreeRow extends WbsTask {
  /** 最上位を0とする階層の深さ。 */
  depth: number;
  /** 直接の子Taskを1件以上持つ場合はtrue。 */
  hasChildren: boolean;
}

/** WBS画面で切り替える階層表・参照専用Ganttの表示形式。 */
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

/** BackendのTask依存関係をDHTMLX Ganttへ渡す読取り専用link。 */
export interface WbsGanttLink {
  /** Task依存関係ID。Gantt内でも一意なlink IDとして使用する。 */
  id: number;
  /** 先行Task ID。 */
  source: number;
  /** 後続Task ID。 */
  target: number;
  /** DHTMLXがFinish-to-Startへ割り当てるlink type。 */
  type: "0";
  /** Gantt上でlinkを直接変更できないようにする。 */
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
