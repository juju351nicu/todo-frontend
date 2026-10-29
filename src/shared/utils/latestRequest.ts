/** `createLatestRequestTracker`が返す、読込の順番の判定。 */
export interface LatestRequestTracker {
  /**
   * 新しい読込を始めたことを記録する。これより前に始めた読込は、この時点で最新でなくなる。
   *
   * @returns この読込がまだ最新（後から別の読込が始まっていない）ならtrueを返す関数
   */
  begin: () => () => boolean;
}

/**
 * 同じ種類の読込を何度も始める画面で、最後に始めた読込の結果だけを画面へ反映するための判定を作る。
 *
 * 表示対象（Task ID等）を素早く切り替えると、先に始めた読込のResponseが後から届き、
 * 新しい対象の表示を古い対象の内容で上書きすることがある。読込を始めるたびに`begin`を呼び、
 * Responseを反映する直前に、返された関数で「まだ最新の読込か」を確かめる。
 *
 * - 判定は読込の順番だけで行い、通信の取り消し（`AbortController`）はしない。古い読込のResponseは捨てるだけ。
 * - 1つの判定を複数の種類の読込で共有しない（別の種類の読込が始まると、もう一方の結果まで捨てられるため）。
 *
 * @returns 読込を始める`begin`を持つ判定
 */
export const createLatestRequestTracker = (): LatestRequestTracker => {
  let latestRequestNumber = 0;
  return {
    begin: () => {
      latestRequestNumber += 1;
      const requestNumber = latestRequestNumber;
      return () => requestNumber === latestRequestNumber;
    },
  };
};
