import type {
  ExecutionSettingForm,
  ExecutionSettingRequest,
  ExecutionSettings,
  ExecutionSession,
} from "@/features/wbs/types/taskExecution";

/** Backendと同じ公開設定の文字数上限。 */
export const EXECUTION_SETTING_LIMITS = {
  agentName: 64,
  modelIdentifier: 128,
  reasoningEffort: 32,
  serviceTier: 32,
} as const;
/** 初回入力時に使用した設定を推測せず、全項目を未選択で作る。 */
export const createExecutionSettingForm = (): ExecutionSettingForm => ({
  timerSessionId: 0,
  progressMeasurementId: 0,
  assistanceMode: "UNSELECTED",
  agentName: "",
  modelIdentifier: "",
  reasoningEffort: "",
  serviceTier: "",
});
/** 空白だけの任意設定を未記録へ揃える。 */
const optionalSetting = (value: string): string | null => value.trim() || null;
/**
 * 公開設定だけをAPI Requestへ変換する。支援なしにmodel等を混ぜない。
 * @param form 本人が確認した入力下書き
 * @returns 送信可能な公開設定。未選択・上限超過等の場合はnull
 */
export const buildExecutionSettingRequest = (
  form: ExecutionSettingForm
): ExecutionSettingRequest | null => {
  if (
    !Number.isSafeInteger(form.timerSessionId) ||
    form.timerSessionId <= 0 ||
    form.assistanceMode === "UNSELECTED" ||
    !Number.isSafeInteger(form.progressMeasurementId) ||
    form.progressMeasurementId < 0
  )
    return null;
  for (const key of Object.keys(
    EXECUTION_SETTING_LIMITS
  ) as (keyof typeof EXECUTION_SETTING_LIMITS)[]) {
    if (
      form[key].length > EXECUTION_SETTING_LIMITS[key] ||
      Array.from(form[key]).some((character) => {
        const code = character.codePointAt(0)!;
        return code < 32 || (code >= 127 && code <= 159);
      })
    )
      return null;
  }
  const settings =
    form.assistanceMode === "NONE"
      ? { agentName: null, modelIdentifier: null, reasoningEffort: null, serviceTier: null }
      : {
          agentName: optionalSetting(form.agentName),
          modelIdentifier: optionalSetting(form.modelIdentifier),
          reasoningEffort: optionalSetting(form.reasoningEffort),
          serviceTier: optionalSetting(form.serviceTier),
        };
  return {
    timerSessionId: form.timerSessionId,
    progressMeasurementId: form.progressMeasurementId || null,
    assistanceMode: form.assistanceMode,
    ...settings,
  };
};
/** 申告なしとAI支援なしを区別する表示名。 */
export const formatExecutionMode = (settings: ExecutionSettings | null): string =>
  settings === null
    ? "設定未記録"
    : { NONE: "AI支援なし", GENERAL_AI: "汎用AI", CODING_AGENT: "Coding Agent" }[
        settings.assistanceMode
      ];

/** BackendのUTC Instantを、最大nanosecondの比較で桁数に影響されない形へ揃える。 */
const sortableInstant = (value: string): string | null => {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  return match ? `${match[1]}.${(match[2] ?? "").padEnd(9, "0")}Z` : null;
};

/**
 * BackendのUTC保存時刻で開始以上・停止未満の計測だけを候補にする。
 * Date.parseのmillisecondへの切り捨てで停止直前の計測を落とさない。
 * @param recordedAt 進捗計測のserver受理時刻
 * @param session 本人停止Timerの時刻範囲
 * @returns 有効な保存形式で区間内にある場合true。最終判定はBackendへ委ねる
 */
export const isWithinExecutionSession = (
  recordedAt: string,
  session: Pick<ExecutionSession, "startedAt" | "stoppedAt">
): boolean => {
  const measurement = sortableInstant(recordedAt);
  const start = sortableInstant(session.startedAt);
  const stop = sortableInstant(session.stoppedAt);
  return (
    measurement !== null &&
    start !== null &&
    stop !== null &&
    start <= measurement &&
    measurement < stop
  );
};
