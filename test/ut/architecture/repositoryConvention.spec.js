import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { INTERNAL_DOCUMENT_REFERENCE_BASELINE } from "./internalDocumentReferenceBaseline.js";

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
const documentedFunctionDirectories = ["/api/"];
/**
 * リポジトリの外の資料を番号で指すコメントの書き方（改善提案の番号、動作確認の項目のパス、Backendの動作確認資料の略称、
 * 開発段階の名前、`§`と番号）。どの資料のどこかが読み手に分からず、資料が変わると意味を失うため、
 * コメントは業務上の意味と理由の文で書く（`docs/coding-guidelines.md`「資料を知らない人が読めるコメントにする」）。
 */
const internalDocumentReference = /改善提案\s*\d|動作確認\s*\/|BE\s*資料|Stage\s*\d+[A-Z]|§\s*\d/g;
/** 資料番号の書き方を探すディレクトリと拡張子。 */
const internalDocumentReferenceSources = [
  { directory: "src", extensions: [".ts", ".vue", ".js"] },
  { directory: "test", extensions: [".ts", ".js"] },
];

/**
 * 資料番号の書き方を、プロジェクトルートからの相対パス（`/`区切り）ごとに数える。
 *
 * @returns {Record<string, number>} 1件以上あるファイルと件数。パスの順に並べる
 */
const countInternalDocumentReferences = () => {
  const counts = {};
  for (const { directory, extensions } of internalDocumentReferenceSources) {
    for (const file of collectProjectTextFiles(join(projectRoot, directory))) {
      if (!extensions.includes(extname(file))) {
        continue;
      }
      const matches = readFileSync(file, "utf8").match(internalDocumentReference);
      if (matches) {
        counts[relative(projectRoot, file).replaceAll("\\", "/")] = matches.length;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
};

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
      return excludedDirectories.has(entry.name) ? [] : collectProjectTextFiles(entryPath);
    }
    return textExtensions.has(extname(entry.name)) ? [entryPath] : [];
  });
};

/** Vue SFCからTypeScript compilerで解析するscript部分だけを取り出す。 */
const extractScript = (source) => source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";

/** 宣言または親のvariable statementにJSDocが付いているか判定する。 */
const hasJSDoc = (node) => {
  let current = node;
  while (current && !ts.isSourceFile(current)) {
    if ((current.jsDoc?.length ?? 0) > 0) {
      return true;
    }
    if (
      ts.isVariableStatement(current) ||
      ts.isFunctionDeclaration(current) ||
      ts.isInterfaceDeclaration(current) ||
      ts.isTypeAliasDeclaration(current) ||
      ts.isClassDeclaration(current) ||
      ts.isEnumDeclaration(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return false;
};

/** TypeScript宣言にexport modifierが付いているか判定する。 */
const isExported = (node) =>
  node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/**
 * exportedな型・関数とAPI境界の内部関数から、JSDoc未記載宣言を収集する。
 * Vue templateとstyleは対象外とし、TypeScript compilerのsyntax treeで複数行宣言も判定する。
 */
const findMissingJSDoc = (file) => {
  const rawSource = readFileSync(file, "utf8");
  const isVueFile = extname(file) === ".vue";
  const source = isVueFile ? extractScript(rawSource) : rawSource;
  if (!source) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const normalizedFile = file.replaceAll("\\", "/");
  const requiresInternalFunctionDoc = documentedFunctionDirectories.some((directory) =>
    normalizedFile.includes(directory)
  );
  const violations = [];

  const report = (node, name) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push(`${relative(projectRoot, file)}:${line + 1} ${name}`);
  };

  const visit = (node) => {
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      isExported(node) &&
      !hasJSDoc(node)
    ) {
      report(node, node.name?.text ?? "default type");
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      const statement = node.parent?.parent;
      const exported = ts.isVariableStatement(statement) && isExported(statement);
      if ((exported || requiresInternalFunctionDoc) && !hasJSDoc(node)) {
        report(node, node.name.getText(sourceFile));
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
};

describe("Repository coding conventions", () => {
  it("旧タスク管理製品の名称をリポジトリへ再混入させない", () => {
    const excludedProductName = new RegExp(["k", "[\\s_.-]*", "tr", "aq"].join(""), "i");
    const violations = collectProjectTextFiles(projectRoot)
      .filter((file) => excludedProductName.test(readFileSync(file, "utf8")))
      .map((file) => relative(projectRoot, file));

    expect(violations).toEqual([]);
  });

  it("コメントに資料の番号（改善提案・動作確認・Backendの動作確認資料・開発段階名・§番号）を増やさない", () => {
    const actual = countInternalDocumentReferences();
    // 一致しないファイルだけを「ベースライン -> 実際」で示す（全件を並べると、どこが違うか読めないため）。
    const paths = new Set([
      ...Object.keys(INTERNAL_DOCUMENT_REFERENCE_BASELINE),
      ...Object.keys(actual),
    ]);
    const differences = [...paths]
      .sort()
      .map((path) => [path, INTERNAL_DOCUMENT_REFERENCE_BASELINE[path] ?? 0, actual[path] ?? 0])
      .filter(([, expectedCount, actualCount]) => expectedCount !== actualCount)
      .map(([path, expectedCount, actualCount]) => `${path}: ${expectedCount} -> ${actualCount}`);

    // 減らした場合も、internalDocumentReferenceBaseline.js を同じ変更で減らす。
    expect(differences).toEqual([]);
  });

  it("exportedな型・関数とAPI境界の関数へJSDocを記載する", () => {
    const sourceFiles = collectProjectTextFiles(join(projectRoot, "src")).filter((file) =>
      [".ts", ".vue"].includes(extname(file))
    );
    const violations = sourceFiles.flatMap(findMissingJSDoc);

    expect(violations).toEqual([]);
  });
});
