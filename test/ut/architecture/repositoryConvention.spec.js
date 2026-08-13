import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".properties",
  ".scss",
  ".ts",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);
const excludedDirectories = new Set([".git", "dist", "node_modules"]);

/**
 * リポジトリ内で規約検査の対象とするテキストファイルを再帰的に収集する。
 *
 * @param {string} directory 検査を開始する絶対パス
 * @returns {string[]} バイナリ、依存ライブラリ、生成物を除いたファイルの絶対パス
 */
const collectProjectTextFiles = (directory) => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return excludedDirectories.has(entry.name)
        ? []
        : collectProjectTextFiles(entryPath);
    }
    return textExtensions.has(extname(entry.name)) ? [entryPath] : [];
  });
};

describe("Repository coding conventions", () => {
  it("旧タスク管理製品の名称をリポジトリへ再混入させない", () => {
    const excludedProductName = new RegExp(
      ["k", "[\\s_.-]*", "tr", "aq"].join(""),
      "i"
    );
    const violations = collectProjectTextFiles(projectRoot)
      .filter((file) => excludedProductName.test(readFileSync(file, "utf8")))
      .map((file) => relative(projectRoot, file));

    expect(violations).toEqual([]);
  });
});
