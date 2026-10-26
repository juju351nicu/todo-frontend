/**
 * Backendが返すアカウントの利用状態コード（`account.status`）。
 * ACTIVE以外のアカウントはログインできず、日別予定・日別実績・繰り返しTask等の担当者にも指定できない。
 * 管理画面のアカウント一覧と、Project参加者の表示（停止中の区別）で共通に使う。
 */
export type AccountStatus = "ACTIVE" | "LOCKED" | "DISABLED";
