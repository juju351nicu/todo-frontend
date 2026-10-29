import {
  PROJECT_KEY_MAX_LENGTH,
  PROJECT_KEY_PATTERN,
} from "@/features/project/constants/projectLimits";

/**
 * Projectキーの長さと形式を、Backendの入力制約に合わせて検証する。
 *
 * Projectの作成とProject Templateの適用で同じ規則を使う。長さを先に調べる（長すぎるキーに形式の文言を出さないため）。
 * 空のキーは形式の誤りとして扱う。入力途中の空欄に文言を出したくない画面は、呼出側で空のときに呼ばない。
 *
 * @param projectKey trim・大文字化した後のProjectキー
 * @returns 誤りの文言。誤りがなければ空文字
 */
export const validateProjectKey = (projectKey: string): string => {
  if (projectKey.length > PROJECT_KEY_MAX_LENGTH) {
    return `Projectキーは${PROJECT_KEY_MAX_LENGTH}文字以内で入力してください。`;
  }
  if (!PROJECT_KEY_PATTERN.test(projectKey)) {
    return "Projectキーは大文字英数字をハイフンで区切って入力してください（例：SALES-2026）。";
  }
  return "";
};
