import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import ts from "typescript";
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
const documentedFunctionDirectories = ["/api/"];

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

/** Vue SFCからTypeScript compilerで解析するscript部分だけを取り出す。 */
const extractScript = (source) =>
  source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? "";

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
  node.modifiers?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  ) ?? false;

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
  const requiresInternalFunctionDoc = documentedFunctionDirectories.some(
    (directory) => normalizedFile.includes(directory)
  );
  const violations = [];

  const report = (node, name) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );
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
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
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
    const excludedProductName = new RegExp(
      ["k", "[\\s_.-]*", "tr", "aq"].join(""),
      "i"
    );
    const violations = collectProjectTextFiles(projectRoot)
      .filter((file) => excludedProductName.test(readFileSync(file, "utf8")))
      .map((file) => relative(projectRoot, file));

    expect(violations).toEqual([]);
  });

  it("exportedな型・関数とAPI境界の関数へJSDocを記載する", () => {
    const sourceFiles = collectProjectTextFiles(join(projectRoot, "src")).filter(
      (file) => [".ts", ".vue"].includes(extname(file))
    );
    const violations = sourceFiles.flatMap(findMissingJSDoc);

    expect(violations).toEqual([]);
  });
});
