/** WBS上でのTask構造種別。BackendのTaskTypeコードと一致する。 */
export type WbsTaskType = "TASK" | "SUMMARY" | "MILESTONE";

/** WBS Taskの優先度。数字が小さいほど優先度が高い。 */
export type WbsTaskPriority = 1 | 2 | 3;

/**
 * Boardと同じTask IDを使用するWBS参照APIの1行。
 * 日付はISO local date、予定工数は分、進捗率は0から100で受け取る。
 * 実績開始日・終了日は未着手または作業中を表すためnullableである。
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
  /** 実績開始日。未着手の場合はnull。 */
  actualStartDate: string | null;
  /** 実績終了日。作業中または未着手の場合はnull。 */
  actualEndDate: string | null;
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
  /** member、Project、曜日既定値の順で解決された稼働可能時間（分）。 */
  availableMinutes: number;
  /** 稼働可能時間から予定工数を引いた残容量（分）。負数は過配賦。 */
  remainingMinutes: number;
  /** 予定工数が稼働可能時間を超える場合はtrue。休日への予定配賦も含む。 */
  overAllocated: boolean;
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

/** 稼働日calendarの1日を稼働日または休日として扱う種別。Backendコードと一致する。 */
export type WorkingDayType = "WORKING_DAY" | "HOLIDAY";

/** 有効な稼働条件を決定した既定値・Project共通・member固有の設定階層。 */
export type WorkingDaySource = "DEFAULT" | "PROJECT" | "MEMBER";

/** Project共通またはProject member固有として保存された日別例外。 */
export interface WorkingDayOverride {
  /** Project共通・member固有テーブル内の稼働日設定ID。 */
  workingDayId: number;
  /** member固有設定の対象アカウントID。Project共通設定ではnull。 */
  accountId: number | null;
  /** 例外設定を適用する日付。yyyy-MM-dd形式。 */
  workDate: string;
  /** 保存された稼働日種別。 */
  dayType: WorkingDayType;
  /** 保存された稼働可能時間（分）。 */
  availableMinutes: number;
  /** 設定を最初に登録した認証済みアカウントID。 */
  createdBy: number;
  /** ISO-8601形式の設定作成時刻。 */
  createdAt: string;
  /** 設定を最後に更新した認証済みアカウントID。 */
  updatedBy: number;
  /** ISO-8601形式の最終更新時刻。 */
  updatedAt: string;
  /** 更新・削除時に送る楽観ロックversion。 */
  version: number;
}

/** 既定値と保存済み例外の優先順位を解決した稼働日calendarの1日。 */
export interface WorkingCalendarDay {
  /** calendar上の日付。yyyy-MM-dd形式。 */
  workDate: string;
  /** 最終的に有効な稼働日種別。 */
  dayType: WorkingDayType;
  /** 最終的に有効な稼働可能時間（分）。 */
  availableMinutes: number;
  /** 有効値を決定した設定階層。 */
  source: WorkingDaySource;
  /** 同日に保存されたProject共通例外。未設定時はnull。 */
  projectOverride: WorkingDayOverride | null;
  /** 同日に保存されたmember固有例外。Project共通参照または未設定時はnull。 */
  memberOverride: WorkingDayOverride | null;
}

/** Project共通または指定Project memberの稼働日calendar API Response。 */
export interface WorkingCalendarResponse {
  /** calendarを所有するProject ID。 */
  projectId: number;
  /** member calendarの対象アカウントID。Project共通参照ではnull。 */
  accountId: number | null;
  /** 検索開始日。yyyy-MM-dd形式。 */
  dateFrom: string;
  /** 検索終了日。yyyy-MM-dd形式。 */
  dateTo: string;
  /** 検索期間の全日付へ既定値を補完した日付順一覧。 */
  days: WorkingCalendarDay[];
}

/** 稼働日calendar検索欄が保持する開始日・終了日。 */
export interface WorkingCalendarDateRange {
  /** 検索開始日。yyyy-MM-dd形式。 */
  dateFrom: string;
  /** 検索終了日。yyyy-MM-dd形式。 */
  dateTo: string;
}

/** 稼働日calendarで表示・編集するProject共通またはmember固有の対象。 */
export type WorkingCalendarTarget =
  | { kind: "PROJECT"; accountId: null }
  | { kind: "MEMBER"; accountId: number };

/** 稼働日calendarの対象selectへ表示するProject共通またはProject member候補。 */
export interface WorkingCalendarTargetOption {
  /** 利用者へ表示する対象名。 */
  title: string;
  /** Project共通またはmemberアカウントIDを復元できる画面内識別子。 */
  value: string;
}

/** 稼働日例外の登録・更新欄が保持するBackend型変換前の入力値。 */
export interface WorkingDayForm {
  /** 例外を適用する日付。未入力時は空文字。 */
  workDate: string;
  /** 稼働日または休日。 */
  dayType: WorkingDayType;
  /** 分単位の稼働可能時間。未入力または数値変換できない場合はnull。 */
  availableMinutes: number | null;
}

/** 稼働日例外登録APIへ送信する検証済みRequest。 */
export interface WorkingDayCreateRequest {
  /** 例外を適用する日付。 */
  workDate: string;
  /** 稼働日または休日。 */
  dayType: WorkingDayType;
  /** 休日は0、稼働日は1分以上1440分以下の稼働可能時間。 */
  availableMinutes: number;
}

/** 稼働日例外更新APIへ送信する検証済みRequest。 */
export interface WorkingDayUpdateRequest extends WorkingDayCreateRequest {
  /** calendar取得時点の楽観ロックversion。 */
  version: number;
}

/** Project内で固定したWBS baseline header。 */
export interface WbsBaselineSummary {
  /** WBS baselineを一意に識別するID。 */
  baselineId: number;
  /** Project内で作成順に採番した表示用連番。 */
  baselineNumber: number;
  /** 利用者が比較対象を識別するbaseline名。 */
  name: string;
  /** 作成理由または計画上の前提。未設定時はnull。 */
  description: string | null;
  /** 現在計画との比較対象として選択されている場合はtrue。 */
  active: boolean;
  /** baselineを作成した認証済みアカウントID。 */
  createdBy: number;
  /** ISO-8601形式の作成時刻。 */
  createdAt: string;
  /** active状態を最後に変更した認証済みアカウントID。 */
  updatedBy: number;
  /** ISO-8601形式の最終更新時刻。 */
  updatedAt: string;
  /** 比較対象切替Requestへ渡す楽観ロックversion。 */
  version: number;
}

/** Projectに保存されたWBS baseline header一覧Response。 */
export interface WbsBaselineListResponse {
  /** baselineを所有するProject ID。 */
  projectId: number;
  /** Project内baseline連番の降順一覧。未登録時は空配列。 */
  baselines: WbsBaselineSummary[];
}

/** baseline作成時点から変更しないTask計画snapshot。 */
export interface WbsBaselineTask {
  /** Board・現在WBSと突合するsnapshot元Task ID。 */
  sourceTaskId: number;
  /** baseline内の親Task ID。最上位Taskはnull。 */
  parentSourceTaskId: number | null;
  /** baseline作成時点のTask構造種別。 */
  taskType: WbsTaskType;
  /** baseline作成時点の画面表示用WBSコード。 */
  wbsCode: string | null;
  /** baseline作成時点の同一親配下表示順。 */
  position: number;
  /** baseline作成時点のTaskタイトル。 */
  title: string;
  /** baseline作成時点のTask詳細。 */
  detail: string;
  /** baseline作成時点のTask優先度。 */
  priority: WbsTaskPriority;
  /** baseline作成時点の予定開始日。yyyy-MM-dd形式。 */
  plannedStartDate: string;
  /** baseline作成時点の予定終了日。yyyy-MM-dd形式。 */
  plannedEndDate: string;
  /** baseline作成時点の予定工数（分）。 */
  plannedEffortMinutes: number;
  /** baseline作成時点の担当アカウントID。 */
  assigneeAccountId: number;
  /** snapshot元Taskのbaseline作成時点version。 */
  sourceTaskVersion: number;
}

/** baseline作成時点から変更しないTask依存snapshot。 */
export interface WbsBaselineDependency {
  /** snapshot元Task依存関係ID。 */
  sourceDependencyId: number;
  /** 先行Taskのsnapshot元Task ID。 */
  predecessorSourceTaskId: number;
  /** 後続Taskのsnapshot元Task ID。 */
  successorSourceTaskId: number;
  /** baseline作成時点の依存種別。 */
  dependencyType: TaskDependencyType;
  /** 先行Task終了から後続Task開始までの待ち時間（分）。 */
  lagMinutes: number;
  /** snapshot元依存関係のbaseline作成時点version。 */
  sourceDependencyVersion: number;
}

/** baseline作成時点から変更しない日別予定工数snapshot。 */
export interface WbsBaselineEffortPlan {
  /** snapshot元Task日別予定工数ID。 */
  sourceEffortPlanId: number;
  /** Board・現在WBSと突合するsnapshot元Task ID。 */
  sourceTaskId: number;
  /** baseline作成時点の予定日。yyyy-MM-dd形式。 */
  planDate: string;
  /** baseline作成時点の日別予定工数（分）。 */
  plannedEffortMinutes: number;
  /** baseline作成時点の予定担当アカウントID。 */
  assigneeAccountId: number;
  /** snapshot元日別予定工数のbaseline作成時点version。 */
  sourceEffortPlanVersion: number;
}

/** WBS baseline headerと変更不能なTask・依存・日別予定snapshotの詳細Response。 */
export interface WbsBaselineDetailResponse {
  /** baselineを所有するProject ID。 */
  projectId: number;
  /** 取得したbaseline header。 */
  baseline: WbsBaselineSummary;
  /** baseline作成時点のTask計画。 */
  tasks: WbsBaselineTask[];
  /** baseline作成時点のTask依存関係。 */
  dependencies: WbsBaselineDependency[];
  /** baseline作成時点の日別予定工数。 */
  effortPlans: WbsBaselineEffortPlan[];
  /** snapshot Taskの予定工数合計（分）。 */
  plannedEffortMinutes: number;
  /** 日別・担当者別へ配賦済みの予定工数合計（分）。 */
  allocatedEffortMinutes: number;
  /** Task予定から配賦済み予定を引いた差（分）。過配賦時は負数。 */
  unallocatedEffortMinutes: number;
}

/** baseline作成Dialogが保持するBackend正規化前の入力値。 */
export interface WbsBaselineCreateForm {
  /** 前後空白を除いて1文字以上100文字以下とするbaseline名。 */
  name: string;
  /** 前後空白を除いて1000文字以下とする任意説明。 */
  description: string;
}

/** 現在計画をWBS baselineへ固定する作成Request。 */
export interface WbsBaselineCreateRequest {
  /** 正規化済みbaseline名。 */
  name: string;
  /** 正規化済み任意説明。空欄はnull。 */
  description: string | null;
}

/** WBS baseline作成結果とsnapshot件数・予定工数集計。 */
export interface WbsBaselineCreateResponse {
  /** 作成したactive baseline header。 */
  baseline: WbsBaselineSummary;
  /** snapshot化したTask件数。 */
  taskCount: number;
  /** snapshot化したTask依存件数。 */
  dependencyCount: number;
  /** snapshot化した日別予定工数件数。 */
  effortPlanCount: number;
  /** snapshot Taskの予定工数合計（分）。 */
  plannedEffortMinutes: number;
  /** 日別・担当者別へ配賦済みの予定工数合計（分）。 */
  allocatedEffortMinutes: number;
  /** Task予定から配賦済み予定を引いた差（分）。過配賦時は負数。 */
  unallocatedEffortMinutes: number;
}

/** 過去baselineを現在の比較対象へ切り替えるRequest。 */
export interface WbsBaselineActivationRequest {
  /** baseline一覧取得時点のheader version。 */
  version: number;
}

/** 現在計画とactive baselineのTask単位比較状態。 */
export type WbsBaselineComparisonStatus =
  | "UNCHANGED"
  | "CHANGED"
  | "CURRENT_ONLY"
  | "BASELINE_ONLY";

/** 現在計画とactive baselineの予定期間・予定工数をTask IDで突合した表示行。 */
export interface WbsBaselineComparisonRow {
  /** Board・現在WBSと共通のTask ID。 */
  sourceTaskId: number;
  /** 現在計画を優先し、存在しない場合はbaselineから補完したWBSコード。 */
  wbsCode: string | null;
  /** 現在計画を優先し、存在しない場合はbaselineから補完したTaskタイトル。 */
  title: string;
  /** 予定値の一致、変更、追加、除外を表す比較状態。 */
  status: WbsBaselineComparisonStatus;
  /** baseline側予定開始日。現在計画だけに存在する場合はnull。 */
  baselinePlannedStartDate: string | null;
  /** baseline側予定終了日。現在計画だけに存在する場合はnull。 */
  baselinePlannedEndDate: string | null;
  /** baseline側予定工数（分）。現在計画だけに存在する場合はnull。 */
  baselinePlannedEffortMinutes: number | null;
  /** 現在側予定開始日。baseline後に除外された場合はnull。 */
  currentPlannedStartDate: string | null;
  /** 現在側予定終了日。baseline後に除外された場合はnull。 */
  currentPlannedEndDate: string | null;
  /** 現在側予定工数（分）。baseline後に除外された場合はnull。 */
  currentPlannedEffortMinutes: number | null;
  /** 現在予定工数からbaseline予定工数を引いた差（分）。 */
  plannedEffortDifferenceMinutes: number;
}

/** EVM集計値の解釈に必要なBackend確定済み警告。 */
export interface EarnedValueWarning {
  /** 警告種別を機械判定する安定したコード。 */
  code: string;
  /** 警告対象Task ID。Project全体の警告ではnull。 */
  taskId: number | null;
  /** 利用者へ表示するBackend確定済みメッセージ。 */
  message: string;
  /** 警告対象工数（分）。工数を伴わない警告ではnull。 */
  minutes: number | null;
}

/** active baselineの通常Task単位でBackendが算出した基準日時点のEVM指標。 */
export interface EarnedValueTask {
  /** baseline snapshot元のBoard・WBS共通Task ID。 */
  sourceTaskId: number;
  /** baseline作成時点の画面表示用WBSコード。 */
  wbsCode: string | null;
  /** baseline作成時点のTaskタイトル。 */
  title: string;
  /** baseline作成時点の予定開始日。yyyy-MM-dd形式。 */
  plannedStartDate: string;
  /** baseline作成時点の予定終了日。yyyy-MM-dd形式。 */
  plannedEndDate: string;
  /** baseline Taskの予定工数（分）。 */
  plannedEffortMinutes: number;
  /** 基準日までのPV（分）。 */
  pv: number;
  /** EVへ適用した進捗snapshot日。履歴がない場合はnull。 */
  progressSnapshotDate: string | null;
  /** EVへ適用した進捗率。履歴がない場合はnull。 */
  progressPercent: number | null;
  /** Backendが小数第2位へ丸めたEV（分）。 */
  ev: number;
  /** 基準日までのAC（分）。 */
  ac: number;
  /** Backendが小数第2位へ丸めたSV（分）。 */
  sv: number;
  /** Backendが小数第2位へ丸めたCV（分）。 */
  cv: number;
}

/** active baselineを基準にBackendが算出したProject単位のEVM Response。 */
export interface EarnedValueResponse {
  /** EVM対象Project ID。 */
  projectId: number;
  /** 計算へ使用したactive baseline ID。 */
  baselineId: number;
  /** Project内のbaseline表示用連番。 */
  baselineNumber: number;
  /** 計算へ使用したbaseline名。 */
  baselineName: string;
  /** baseline作成日時を業務timezoneへ変換した日付。 */
  baselineDate: string;
  /** EVM計算の基準日。yyyy-MM-dd形式。 */
  statusDate: string;
  /** 日付境界の判定に使用したIANA timezone ID。 */
  businessZoneId: string;
  /** EVM価値単位。初期契約では常にMINUTES。 */
  valueUnit: "MINUTES";
  /** BAC（分）。 */
  bac: number;
  /** PV（分）。 */
  pv: number;
  /** Backendが小数第2位へ丸めたEV（分）。 */
  ev: number;
  /** AC（分）。 */
  ac: number;
  /** Backendが小数第2位へ丸めたSV（分）。 */
  sv: number;
  /** Backendが小数第2位へ丸めたCV（分）。 */
  cv: number;
  /** Backendが小数第4位へ丸めたSPI。PVが0の場合はnull。 */
  spi: number | null;
  /** Backendが小数第4位へ丸めたCPI。ACが0の場合はnull。 */
  cpi: number | null;
  /** 計画進捗率。BACが0の場合はnull。 */
  plannedProgressPercent: number | null;
  /** 出来高進捗率。BACが0の場合はnull。 */
  earnedProgressPercent: number | null;
  /** baseline日別予定工数の全期間合計（分）。 */
  baselineAllocatedEffortMinutes: number;
  /** BACから全期間配賦工数を引いた差（分）。過配賦時は負数。 */
  baselineAllocationVarianceMinutes: number;
  /** baseline外TaskからACへ算入しなかった実績工数（分）。 */
  excludedActualEffortMinutes: number;
  /** 集計値の判断に必要な業務警告。警告なしでは空配列。 */
  warnings: EarnedValueWarning[];
  /** baselineの通常Task単位のEVM明細。 */
  tasks: EarnedValueTask[];
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
  /** 実績開始日。未着手へ戻す場合は空文字。 */
  actualStartDate: string;
  /** 実績終了日。未完了または未着手の場合は空文字。 */
  actualEndDate: string;
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
  /** 更新後の実績開始日。未着手の場合はnull。 */
  actualStartDate: string | null;
  /** 更新後の実績終了日。作業中または未着手の場合はnull。 */
  actualEndDate: string | null;
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
  /** tooltipへ予定開始日を排他的終了境界へ変換せず表示するための値。 */
  plannedStartDate: string;
  /** tooltipへ予定終了日を当日を含む業務日として表示するための値。 */
  plannedEndDate: string;
  /** tooltipへ表示する実績開始日。未着手の場合はnull。 */
  actualStartDate: string | null;
  /** tooltipへ表示する実績終了日。作業中または未着手の場合はnull。 */
  actualEndDate: string | null;
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
