/**
 * FrontendがBackend本文なしでも表示できる固定文言catalog。
 * Backendのmessageは表示専用とし、画面分岐にはHTTP statusとerror codeを使用する。
 */
export const DISPLAY_MESSAGES = {
  common: {
    connectionFailed: "Backendへ接続できませんでした。",
    requestFailed: "処理を完了できませんでした。しばらくしてから再度お試しください。",
  },
  auth: {
    credentialsRejected: "ログインIDまたはパスワードが正しくありません。",
    invalidInput: "ログイン情報を確認してください。",
    requestForbidden: "ログインの準備を更新できませんでした。画面を再読み込みしてお試しください。",
    loginFailed: "ログインできませんでした。",
    loginRequired: "この画面を開くにはログインが必要です。ログインしてください。",
    sessionRestoreFailed: "ログイン後の利用者情報を確認できませんでした。もう一度お試しください。",
    oauth: {
      emailRequired:
        "GitHubからメールアドレスを取得できませんでした。GitHubのメール設定を確認してください。",
      accountUnavailable: "このアカウントは現在利用できません。",
      unsupportedProvider: "対応していないOAuth2プロバイダーです。",
      loginFailed: "GitHubでログインできませんでした。もう一度お試しください。",
    },
  },
  inquiry: {
    invalidInput: "お問い合わせ内容を確認してください。",
    sendFailed: "お問い合わせを送信できませんでした。時間を置いて再度お試しください。",
    sent: "お問い合わせを送信しました。",
  },
  administration: {
    account: {
      readForbidden: "アカウントとロールを参照するpermissionがありません。",
      operationForbidden: "アカウントのロールを変更するpermissionがありません。",
      resourceNotFound: "対象のアカウントが見つかりません。",
      targetRequired: "変更対象のアカウントを選択してください。",
      roleSelectionRequired: "ロールを1件以上選択してください。",
      loadFailed: "アカウントとロールを取得できませんでした。",
      updateFailed: "アカウントのロールを更新できませんでした。",
      reloadFailed: "最新のアカウント情報を再取得できませんでした。再読込してください。",
      /** version競合（409）の後に、画面側で一覧を取り直せたときにBackendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のアカウント情報を再取得しました。内容を確認してから、もう一度変更してください。",
    },
    audit: {
      readForbidden: "監査ログを参照するpermissionがありません。",
      loadFailed: "権限変更監査ログを取得できませんでした。",
    },
  },
  billing: {
    loadFailed: "契約状態を取得できませんでした。",
    operationForbidden: "課金操作を開始できませんでした。画面を再読み込みしてください。",
    checkoutFailed: "Checkoutを開始できませんでした。",
    portalFailed: "請求情報の管理画面を開けませんでした。",
    invalidHostedUrl: "安全なStripe画面を開けませんでした。再度お試しください。",
    checkoutCanceled: "Checkoutをキャンセルしました。契約状態は変更されていません。",
    checkoutPending:
      "決済結果を確認しています。しばらくしてから「契約状態を再読み込み」を実行してください。",
    checkoutCompleted: "Pro契約が反映されました。有料機能を利用できます。",
    administration: {
      readForbidden: "課金状態を参照するpermissionがありません。",
      reconcileForbidden: "課金状態を再照合するpermissionがありません。",
      loadFailed: "課金Account一覧を取得できませんでした。",
      reconcileFailed: "Stripe最新状態と再照合できませんでした。",
      reloadFailed: "再照合は完了しましたが、最新の課金状態を取得できませんでした。",
      reconciled: (displayName: string): string =>
        `${displayName}さんの課金状態をStripe最新状態と照合しました。`,
    },
  },
  notification: {
    announcement: {
      invalidInput: "件名と本文を入力上限内で入力してください。",
      invalidExpiration: "表示終了日時を正しく入力してください。",
      operationForbidden: "お知らせを配信するpermissionがありません。",
      publishFailed: "お知らせを配信できませんでした。入力内容を確認してください。",
      published: "お知らせを全利用者へ配信しました。",
    },
  },
  dashboard: {
    loadFailed: "Dashboardを取得できませんでした。",
    advancedConnectionFailed: "高度Dashboardへ接続できませんでした。",
    advancedLoadFailed: "高度Dashboardを取得できませんでした。",
  },
  attendance: {
    /** version競合等（409）の後に、画面側で勤怠を取り直せたときにBackendの文言の後ろへ添える案内。 */
    conflictReloaded: "最新の勤怠を再取得しました。内容を確認してから、もう一度操作してください。",
    self: {
      forbidden: "本人勤怠を操作するpermissionがありません。",
      accountNotFound: "勤怠対象のアカウントが見つかりません。",
      punchFailed: "打刻を確定できませんでした。",
      submitMonthFailed: "月次勤怠を提出できませんでした。",
      correctionRequestFailed: "勤怠修正を申請できませんでした。",
      correctionCancelFailed: "勤怠修正申請を取り消せませんでした。",
      loadFailed: "勤怠情報を取得できませんでした。",
      monthRefreshFailed: "月間勤怠を更新できませんでした。",
      dayLoadFailed: "選択日の勤怠を取得できませんでした。",
    },
    administration: {
      forbidden: "勤怠月を参照または更新するpermissionがありません。",
      resourceNotFound: "対象のアカウントまたは勤怠月が見つかりません。",
      correctionCurrentLoadFailed: "修正対象の現在勤怠を取得できませんでした。",
      monthListLoadFailed: "勤怠月一覧を取得できませんでした。",
      correctionListLoadFailed: "勤怠修正申請一覧を取得できませんでした。",
      monthDetailLoadFailed: "勤怠月詳細を取得できませんでした。",
      monthUpdateFailed: "勤怠月の状態を更新できませんでした。",
      correctionReviewFailed: "勤怠修正申請を審査できませんでした。",
      exportForbidden: "月次勤怠CSVを出力するpermissionがありません。",
      exportFailed: "月次勤怠CSVを出力できませんでした。",
    },
  },
  project: {
    readForbidden: "Projectを参照するpermissionがありません。",
    projectNotFound: "Projectが見つからないか、このProjectへ参加していません。",
    listLoadFailed: "Project一覧を取得できませんでした。",
    create: {
      forbidden: "Projectを作成するpermissionがありません。",
      failed: "Projectを作成できませんでした。",
    },
    settings: {
      operationForbidden: "この操作を実行するpermissionがありません。",
      resourceNotFound: "対象のProjectまたはmemberが見つかりません。",
      updateFailed: "Project情報を更新できませんでした。",
      archiveFailed: "Projectをアーカイブできませんでした。",
      memberAddFailed: "Project memberを追加できませんでした。",
      memberCandidateSearchFailed: "メンバーの候補を検索できませんでした。",
      memberRoleUpdateFailed: "Project memberのroleを更新できませんでした。",
      memberRemoveFailed: "Project memberを除外できませんでした。",
      reloadFailed: "最新のProject情報を再取得できませんでした。",
      /** 409の後に画面側でProject詳細を取り直せたときに、Backendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のProject情報を再取得しました。内容を確認してから、もう一度操作してください。",
      memberRemovedRefreshFailed:
        "Project memberは除外されましたが、最新のProject情報を取得できませんでした。",
    },
    template: {
      readForbidden: "Project Templateを参照するpermissionがありません。",
      operationForbidden: "Project Templateを操作するpermissionがありません。",
      resourceNotFound: "対象のProjectまたはProject Templateが見つかりません。",
      listLoadFailed: "Project Template一覧を取得できませんでした。",
      detailLoadFailed: "Project Template詳細を取得できませんでした。",
      captureFailed: "ProjectをTemplateとして保存できませんでした。",
      updateFailed: "Project Templateを更新できませんでした。",
      archiveFailed: "Project Templateをアーカイブできませんでした。",
      applyFailed: "Project TemplateからProjectを作成できませんでした。",
      reloadFailed: "最新のProject Templateを再取得できませんでした。再読込してください。",
      /** version競合の409の後に画面側でTemplateを取り直せたときに、Backendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のProject Templateを再取得しました。内容を確認してから、もう一度操作してください。",
    },
  },
  task: {
    myTasks: {
      readForbidden: "My Tasksを参照するpermissionがありません。",
      operationForbidden: "Taskを完了するpermissionがありません。",
      resourceNotFound: "対象のTaskが見つかりません。",
      loadFailed: "My Tasksを取得できませんでした。",
      completeFailed: "Taskを完了状態へ更新できませんでした。",
      completedRefreshFailed:
        "Taskは完了しましたが、最新のMy Tasksを取得できませんでした。再読込してください。",
      reloadFailed: "最新のMy Tasksを取得できませんでした。再読込してください。",
      /** 完了したTaskは一覧から消えるため、何が完了したかを示す。 */
      completed: (title: string): string => `「${title}」を完了しました。`,
    },
    taskList: {
      readForbidden: "Taskを参照するpermissionがありません。",
      operationForbidden: "Taskを更新するpermissionがありません。",
      resourceNotFound: "対象のTaskが見つかりません。",
      listLoadFailed: "Task情報を取得できませんでした。",
      calendarLoadFailed: "Taskカレンダーを取得できませんでした。",
      detailLoadFailed: "Task情報を取得できませんでした。Task一覧から開き直してください。",
      saveFailed: "Task情報を保存できませんでした。",
      conflict: "Taskが別の操作で更新されたか、対象が存在しません。最新情報を確認してください。",
      savedRefreshFailed:
        "Taskは保存されましたが、最新情報を取得できませんでした。Task一覧から開き直してください。",
      completeFailed: "Taskを完了状態へ更新できませんでした。",
      completedRefreshFailed:
        "Taskは完了しましたが、最新の一覧を取得できませんでした。再読込してください。",
      reloadFailed: "最新のTask情報を取得できませんでした。Task一覧から開き直してください。",
      /** 一覧の「完了」の後に、どのTaskを完了したかを示す。 */
      completed: (title: string): string => `「${title}」を完了しました。`,
    },
    board: {
      readForbidden: "Project BoardまたはTaskを参照するpermissionがありません。",
      operationForbidden: "このTask操作を実行するpermissionがありません。",
      resourceNotFound: "対象のProjectまたはTaskが見つかりません。",
      loadFailed: "Project Boardを取得できませんでした。",
      detailLoadFailed: "Task詳細を取得できませんでした。",
      saveFailed: "Taskを保存できませんでした。",
      savedRefreshFailed: "Taskは保存されましたが、最新のProject Boardを取得できませんでした。",
      archiveFailed: "Taskをアーカイブできませんでした。",
      archivedRefreshFailed:
        "Taskはアーカイブされましたが、最新のProject Boardを取得できませんでした。",
      moveFailed: "Taskを移動できませんでした。",
      reloadFailed: "最新のProject Boardを再取得できませんでした。",
      conflictReloaded:
        "最新のProject Boardを再取得しました。内容を確認してから、もう一度操作してください。",
    },
    comments: {
      readForbidden: "Taskコメントを参照するpermissionがありません。",
      operationForbidden: "このコメント操作を実行するpermissionがありません。",
      resourceNotFound: "対象のProject、Taskまたはコメントが見つかりません。",
      loadFailed: "コメントを取得できませんでした。",
      projectLoadFailed: "Projectのコメントを取得できませんでした。",
      created: "コメントを投稿しました。",
      updated: "コメントを更新しました。",
      deleted: "コメントを削除しました。",
      /** 本文が空・長すぎる状態で投稿・更新を呼んだときの文言。上限はTASK_COMMENT_MAX_LENGTHと同じ。 */
      bodyInvalid: "コメント本文を1〜2000文字で入力してください。",
      createFailed: "コメントを投稿できませんでした。",
      updateFailed: "コメントを更新できませんでした。",
      deleteFailed: "コメントを削除できませんでした。",
      reloadFailed: "最新のコメント一覧を取得できませんでした。再読込してください。",
      /** 404・409の後に画面側で一覧を取り直せたときに、Backendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のコメント一覧を再取得しました。内容を確認してから、もう一度操作してください。",
      /** 404・409でBackendの文言を表示できない（未知のerror code等）ときの代わりの文言。 */
      conflictFallback: "コメントが変更されています。最新の一覧を表示しました。",
    },
    checklist: {
      readForbidden: "Task checklistを参照するpermissionがありません。",
      operationForbidden: "このchecklist操作を実行するpermissionがありません。",
      resourceNotFound: "対象のProject、Taskまたはchecklist itemが見つかりません。",
      loadFailed: "チェックリストを取得できませんでした。",
      created: "チェック項目を追加しました。",
      updated: "チェック項目を更新しました。",
      deleted: "チェック項目を削除しました。",
      /** Enterキーで保存したときに本文が空・長すぎる場合の文言。上限はCHECKLIST_ITEM_MAX_LENGTHと同じ。 */
      contentInvalid: "チェック項目を1〜255文字で入力してください。",
      createFailed: "チェック項目を追加できませんでした。",
      updateFailed: "チェック項目を更新できませんでした。",
      toggleFailed: "完了状態を更新できませんでした。",
      reorderFailed: "チェック項目を並び替えできませんでした。",
      deleteFailed: "チェック項目を削除できませんでした。",
      reloadFailed: "最新のチェックリストを取得できませんでした。再読込してください。",
      /** 404・409の後に画面側で一覧を取り直せたときに、Backendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のチェックリストを再取得しました。内容を確認してから、もう一度操作してください。",
      /** 404・409でBackendの文言を表示できない（未知のerror code等）ときの代わりの文言。 */
      conflictFallback: "チェックリストが変更されています。最新の一覧を表示しました。",
    },
    search: {
      readForbidden: "Task検索を参照するpermissionがありません。",
      operationForbidden: "このSaved View操作を実行するpermissionがありません。",
      resourceNotFound: "対象のSaved Viewが見つかりません。",
      initializeFailed: "Task検索画面を初期化できませんでした。",
      searchFailed: "Taskを検索できませんでした。",
      optionsLoadFailed: "検索候補を取得できませんでした。",
      createFailed: "Saved Viewを登録できませんでした。",
      updateFailed: "Saved Viewを更新できませんでした。",
      deleteFailed: "Saved Viewを削除できませんでした。",
      reloadFailed: "最新のSaved View一覧を取得できませんでした。再読込してください。",
      savedRefreshFailed:
        "Saved Viewの変更は完了しましたが、最新の一覧を取得できませんでした。再読込してください。",
      /** version競合の409の後に画面側で一覧を取り直せたときに、Backendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のSaved Viewを再取得しました。内容を確認してから、もう一度操作してください。",
      /** キーワードがBackendの上限を超えたとき。Backendの既定の文言は項目名を含まないため画面で先に止める。 */
      keywordTooLong: "キーワードは100文字以内で入力してください。",
    },
    template: {
      readForbidden: "Task Templateを参照するpermissionがありません。",
      operationForbidden: "このTask Template操作を実行するpermissionがありません。",
      resourceNotFound: "対象のProject、TaskまたはTask Templateが見つかりません。",
      listLoadFailed: "Task Templateを取得できませんでした。",
      captureFailed: "TaskをTemplateとして保存できませんでした。",
      updateFailed: "Task Templateを更新できませんでした。",
      archiveFailed: "Task Templateをアーカイブできませんでした。",
      applyFailed: "Task TemplateをProjectへ適用できませんでした。",
      reloadFailed: "最新のTask Template一覧を取得できませんでした。再読込してください。",
    },
    recurrence: {
      readForbidden: "繰り返しTask規則を参照するpermissionがありません。",
      operationForbidden: "この繰り返しTask操作を実行するpermissionがありません。",
      resourceNotFound:
        "対象のProject、繰り返しTask規則、生成履歴またはTask Templateが見つかりません。",
      listLoadFailed: "繰り返しTask規則を取得できませんでした。",
      generationLoadFailed: "生成履歴を取得できませんでした。",
      createFailed: "繰り返しTask規則を作成できませんでした。",
      updateFailed: "繰り返しTask規則を更新できませんでした。",
      archiveFailed: "繰り返しTask規則をアーカイブできませんでした。",
      retryFailed: "生成を再試行できませんでした。",
      reloadFailed: "最新の繰り返しTask規則と生成履歴を取得できませんでした。再読込してください。",
      completedRefreshFailed:
        "操作は完了しましたが、最新の繰り返しTask規則と生成履歴を取得できませんでした。再読込してください。",
    },
  },
  timeTracking: {
    currentLoadFailed: "現在Timerを取得できませんでした。",
    startFailed: "TaskのTimerを開始できませんでした。",
    stopFailed: "Timerを停止できませんでした。",
    cancelFailed: "Timerを取消できませんでした。",
    operationForbidden: "このTaskでTimerを操作する権限がありません。",
    resourceNotFound: "対象のProjectまたはTaskが見つかりません。",
    historyLoadFailed: "Timer履歴を取得できませんでした。",
    auditLoadFailed: "Task実績工数の変更履歴を取得できませんでした。",
    auditForbidden: "Task実績工数の変更履歴を参照する権限がありません。",
    conflict: {
      alreadyRunning: "別の画面またはタブでTimerが開始されています。現在Timerを再取得しました。",
      notRunning: "Timerはすでに停止または取消されています。現在状態を再取得しました。",
      version: "Timerが別の操作で更新されました。現在状態を再取得しました。",
      durationExceeded:
        "連続24時間を超えているため停止できません。Timerを取消し、正しい工数を手入力してください。",
      dailyLimitExceeded:
        "日別実績が1440分を超えるため停止できません。Timerを取消し、正しい工数を手入力してください。",
      changed: "Timerの状態が別の操作で変更されました。現在状態を再取得しました。",
    },
  },
  wbs: {
    projectNotFound: "Projectが見つからないか、このProjectへ参加していません。",
    readForbidden: "WBSを参照するpermissionがありません。",
    readFailed: "WBSを取得できませんでした。",
    updateForbidden: "WBSを更新するpermissionがありません。",
    taskNotFound: "対象のProjectまたはTaskが見つかりません。",
    updateFailed: "WBS Taskを更新できませんでした。",
    conflict: "WBSが他の操作で更新されました。最新情報を確認してください。",
    reloadFailed: "最新のWBSを再取得できませんでした。再読込してください。",
    /** Task更新のversion競合（409）の後に、画面側で最新WBSを取り直せたときにBackendの文言の後ろへ添える案内。 */
    conflictReloaded: "最新のWBSを再取得しました。内容を確認してから、もう一度編集してください。",
    earnedValue: {
      forbidden: "EVMを参照するpermissionがありません。",
      activeBaselineRequired: "EVMを集計するにはactive baselineが必要です。",
      loadFailed: "EVMを取得できませんでした。",
    },
    report: {
      forbidden: "Excel帳票を出力するpermissionがありません。",
      activeBaselineRequired: "Excel帳票を出力するにはactive baselineが必要です。",
      downloadFailed: "Excel帳票をダウンロードできませんでした。",
    },
    dependency: {
      forbidden: "Task依存関係を更新するpermissionがありません。",
      resourceNotFound: "対象のProjectまたはTaskが見つかりません。",
      createConflict: "Task依存関係が他の操作と競合しました。最新情報を確認してください。",
      createFailed: "Task依存関係を追加できませんでした。",
      stale: "Task依存関係が更新または削除されています。最新情報を確認してください。",
      deleteFailed: "Task依存関係を削除できませんでした。",
      reloadFailed: "最新のWBSとTask依存関係を再取得できませんでした。再読込してください。",
    },
    workload: {
      forbidden: "workloadを参照するpermissionがありません。",
      loadFailed: "担当者別workloadを取得できませんでした。",
    },
    estimateAccuracy: {
      forbidden: "見積もり精度を参照するpermissionがありません。",
      loadFailed: "見積もり精度を取得できませんでした。",
    },
    taskEstimate: {
      readForbidden: "Task見積もりを参照するpermissionがありません。",
      readNotFound: "対象のProjectまたはTaskが見つかりません。",
      loadFailed: "Task見積もりを取得できませんでした。",
      updateForbidden: "このTaskへHuman Estimateを追加する権限がありません。",
      resourceNotFound: "対象のProjectまたはTaskが見つかりません。",
      conflict: "Taskまたは見積もり履歴が他の操作で更新されました。最新情報を確認してください。",
      saveFailed: "Human Estimateを保存できませんでした。",
      reloadFailed: "最新のTaskと見積もり履歴を再取得できませんでした。再読込してください。",
    },
    workingCalendar: {
      readForbidden: "稼働日calendarを参照するpermissionがありません。",
      loadFailed: "稼働日calendarを取得できませんでした。",
      updateForbidden: "このcalendar設定を更新する権限がありません。",
      deleteForbidden: "このcalendar設定を削除する権限がありません。",
      resourceNotFound: "対象のProject、memberまたは稼働日例外が見つかりません。",
      conflict: "稼働日例外が他の操作と競合しました。最新情報を確認してください。",
      saveFailed: "稼働日例外を保存できませんでした。",
      stale: "稼働日例外が更新または削除されています。最新情報を確認してください。",
      deleteFailed: "稼働日例外を削除できませんでした。",
      /** 表示対象を変更する権限がない場合に、calendarの上へ出す案内。 */
      readOnly:
        "この表示対象は参照専用です。Project共通設定はOWNER・MANAGER・SYSTEM_ADMIN、個人例外は本人またはProject管理者が変更できます。",
      /** archive済みProjectのcalendarを表示している場合の案内。Backendは変更を409にする。 */
      archivedReadOnly: "archive済みProjectのcalendarは参照だけできます。",
      /** 無効化・ロックされた参加者の個人例外を表示している場合の案内。Backendは個人例外の登録・更新を400にする。 */
      inactiveMemberReadOnly: "無効化またはロックされたアカウントの個人例外は参照だけできます。",
      /** version競合（409）の後に、画面側でcalendarを取り直せたときにBackendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のcalendarを再取得しました。内容を確認してから、もう一度操作してください。",
      reloadFailed: "最新の稼働日calendarを再取得できませんでした。再読込してください。",
    },
    effortPlan: {
      readForbidden: "Task日別予定を参照するpermissionがありません。",
      readNotFound: "対象のProjectまたは通常Taskが見つかりません。",
      loadFailed: "Task日別予定を取得できませんでした。",
      updateForbidden: "Task日別予定を更新する権限がありません。",
      deleteForbidden: "Task日別予定を削除する権限がありません。",
      resourceNotFound: "対象のProject、Taskまたは日別予定が見つかりません。",
      conflict: "日別予定が他の操作と競合しました。最新情報を確認してください。",
      saveFailed: "Task日別予定を保存できませんでした。",
      stale: "日別予定が更新または削除されています。最新情報を確認してください。",
      deleteFailed: "Task日別予定を削除できませんでした。",
      reloadFailed: "最新の日別予定を再取得できませんでした。Dialogを閉じて再読込してください。",
    },
    workLog: {
      readForbidden: "Task日別実績を参照するpermissionがありません。",
      readNotFound: "対象のProjectまたは通常Taskが見つかりません。",
      loadFailed: "Task日別実績を取得できませんでした。",
      updateForbidden: "Task日別実績を更新する権限がありません。",
      deleteForbidden: "Task日別実績を削除する権限がありません。",
      resourceNotFound: "対象のProject、Taskまたは日別実績が見つかりません。",
      conflict: "日別実績が他の操作と競合しました。最新情報を確認してください。",
      saveFailed: "Task日別実績を保存できませんでした。",
      stale: "日別実績が更新または削除されています。最新情報を確認してください。",
      deleteFailed: "Task日別実績を削除できませんでした。",
      reloadFailed: "最新の日別実績を再取得できませんでした。Dialogを閉じて再読込してください。",
    },
    baseline: {
      forbidden: "baselineを更新するにはProjectのOWNERまたはMANAGER権限が必要です。",
      resourceNotFound: "対象のProjectまたはbaselineが見つかりません。",
      conflict: "baselineが他の操作で更新されました。最新情報を確認してください。",
      reloadFailed: "最新のbaselineを再取得できませんでした。画面を再読込してください。",
      /** 409（version競合・作成競合）の後に、画面側でbaselineを取り直せたときにBackendの文言の後ろへ添える案内。 */
      conflictReloaded:
        "最新のbaselineを再取得しました。内容を確認してから、もう一度操作してください。",
    },
  },
} as const;

/** 固定文言catalog全体の型。 */
export type DisplayMessageCatalog = typeof DISPLAY_MESSAGES;
