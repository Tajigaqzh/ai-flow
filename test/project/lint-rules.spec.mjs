import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(import.meta.url), '..', '..', '..');
const tempDir = join(rootDir, 'tmp', 'lint-rules');
const eslintBin =
  process.platform === 'win32'
    ? join(rootDir, 'node_modules', '.bin', 'eslint.CMD')
    : join(rootDir, 'node_modules', '.bin', 'eslint');

function lintSource(fileName, source) {
  const filePath = join(tempDir, fileName);

  writeFileSync(filePath, source);
  execFileSync(eslintBin, [filePath, '--max-warnings=0'], {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
}

function assertLintFails(fileName, source, expectedMessage) {
  try {
    lintSource(fileName, source);
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;

    if (!output.includes(expectedMessage)) {
      throw new Error(`Expected lint output to include ${expectedMessage}`);
    }

    return;
  }

  throw new Error(`${fileName} should fail lint`);
}

rmSync(tempDir, { force: true, recursive: true });
mkdirSync(tempDir, { recursive: true });

assertLintFails(
  'no-explicit-any.ts',
  'const value: any = 1;\nvoid value;\n',
  '@typescript-eslint/no-explicit-any',
);

assertLintFails(
  'no-unused-vars.ts',
  'const unusedValue = 1;\nconst usedValue = 2;\nvoid usedValue;\n',
  '@typescript-eslint/no-unused-vars',
);

assertLintFails(
  'no-unused-react-import.tsx',
  [
    'import { useState } from "react";',
    'export function Page() {',
    '  return <main>Ready</main>;',
    '}',
  ].join('\n'),
  '@typescript-eslint/no-unused-vars',
);

assertLintFails(
  'no-unused-component-import.tsx',
  [
    'import TechIndicators from "../components/TechIndicators";',
    'export function Page() {',
    '  return <main>Ready</main>;',
    '}',
  ].join('\n'),
  '@typescript-eslint/no-unused-vars',
);

assertLintFails(
  'no-unused-arrow-handler.tsx',
  [
    'export function Page({ history }: { history: { go: (delta: number) => void } }) {',
    '  const back = () => {',
    '    history.go(-1);',
    '  };',
    '  return <main>Ready</main>;',
    '}',
  ].join('\n'),
  '@typescript-eslint/no-unused-vars',
);

assertLintFails('no-var.ts', 'var count = 1;\nvoid count;\n', 'no-var');

assertLintFails(
  'prefer-const-for-unmodified-let.ts',
  'let count = 1;\nvoid count;\n',
  'prefer-const',
);

assertLintFails(
  'no-const-assign.ts',
  'const count = 1;\ncount = 2;\nvoid count;\n',
  'no-const-assign',
);

assertLintFails(
  'no-empty-arrow-function.ts',
  'const noop = () => {};\nvoid noop;\n',
  '@typescript-eslint/no-empty-function',
);

assertLintFails(
  'require-semicolon.ts',
  'const value = 1\nconsole.log(value)\n',
  'Missing semicolon',
);

assertLintFails('no-console-log.ts', 'console.log("debug");\n', 'no-console');

assertLintFails('no-console-warn.ts', 'console.warn("debug");\n', 'no-console');

assertLintFails(
  'no-console-error.ts',
  'console.error("debug");\n',
  'no-console',
);

assertLintFails('no-debugger.ts', 'debugger;\n', 'no-debugger');

assertLintFails(
  'react-hooks-conditional-call.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page({ enabled }: { enabled: boolean }) {',
    '  if (enabled) {',
    '    useEffect(() => {}, []);',
    '  }',
    '  return null;',
    '}',
  ].join('\n'),
  'react-hooks/rules-of-hooks',
);

assertLintFails(
  'no-empty-catch.ts',
  ['try {', '  throw new Error("failed");', '} catch (error) {', '}'].join(
    '\n',
  ),
  'no-empty',
);

assertLintFails(
  'require-strict-equality.ts',
  'const isSame = "1" == 1;\nvoid isSame;\n',
  'eqeqeq',
);

assertLintFails(
  'operator-spacing.tsx',
  [
    'export function Page({ topButtonVisible }: { topButtonVisible: boolean }) {',
    '  return topButtonVisible  &&   <div>Top</div>;',
    '}',
  ].join('\n'),
  'no-multi-spaces',
);

assertLintFails(
  'logical-or-spacing.ts',
  'const enabled = true  ||   false;\nvoid enabled;\n',
  'no-multi-spaces',
);

assertLintFails(
  'object-key-spacing.ts',
  'const value = { top : 0 };\nvoid value.top;\n',
  'key-spacing',
);

assertLintFails(
  'jsx-first-prop-new-line.tsx',
  [
    'export function Page() {',
    '  return (',
    '    <div className="topButton"',
    '      style={{ alignItems: "flex-end" }}',
    '    />',
    '  );',
    '}',
  ].join('\n'),
  'react-local/jsx-first-prop-new-line',
);

assertLintFails(
  'jsx-indent-props.tsx',
  [
    'export function Page() {',
    '  return (',
    '    <div',
    '         className="topButton"',
    '         style={{ alignItems: "flex-end" }}',
    '    />',
    '  );',
    '}',
  ].join('\n'),
  'react-local/jsx-indent-props',
);

assertLintFails(
  'jsx-indent.tsx',
  [
    'export function Page() {',
    '  return (',
    '    <div>',
    '             <span>Title</span>',
    '    </div>',
    '  );',
    '}',
  ].join('\n'),
  'react-local/jsx-indent',
);

assertLintFails(
  'require-trailing-comma.ts',
  ['const value = {', '  title: "ok"', '};', 'void value.title;'].join('\n'),
  'comma-dangle',
);

assertLintFails(
  'no-single-letter-variable.ts',
  'const a = 1;\nvoid a;\n',
  'single-letter variable names',
);

assertLintFails(
  'no-single-letter-parameter.ts',
  'const doubleValue = (b: number) => b * 2;\nvoid doubleValue;\n',
  'single-letter parameter names',
);

assertLintFails(
  'no-single-letter-property.ts',
  'const value = { c: 1 };\nvoid value.c;\n',
  'single-letter property names',
);

assertLintFails(
  'no-single-letter-type-property.ts',
  'interface Model { d: string }\nconst value: Model = { d: "ok" };\nvoid value.d;\n',
  'single-letter type property names',
);

assertLintFails(
  'use-effect-add-event-listener-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    window.addEventListener("scroll", () => window.scrollY);',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'must return a cleanup function',
);

assertLintFails(
  'use-effect-onscroll-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    window.onscroll = () => window.scrollY;',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'must return a cleanup function',
);

assertLintFails(
  'use-effect-set-interval-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    setInterval(() => Date.now(), 1000);',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'must return a cleanup function',
);

assertLintFails(
  'use-effect-set-timeout-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    window.setTimeout(() => Date.now(), 1000);',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'must return a cleanup function',
);

assertLintFails(
  'no-empty-use-effect.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {}, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'Empty useEffect callbacks are not allowed',
);

assertLintFails(
  'no-empty-async-use-effect.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(async () => {}, []);',
    '  return null;',
    '}',
  ].join('\n'),
  'Empty useEffect callbacks are not allowed',
);

assertLintFails(
  'no-empty-use-callback.tsx',
  [
    'import { useCallback } from "react";',
    'export function Page() {',
    '  const onClick = useCallback(() => {}, []);',
    '  return <button onClick={onClick}>Save</button>;',
    '}',
  ].join('\n'),
  'Empty useCallback callbacks are not allowed',
);

assertLintFails(
  'no-empty-use-memo.tsx',
  [
    'import { useMemo } from "react";',
    'export function Page() {',
    '  const value = useMemo(() => {}, []);',
    '  return <span>{value}</span>;',
    '}',
  ].join('\n'),
  'Empty useMemo callbacks are not allowed',
);

assertLintFails(
  'no-direct-imported-component-return.tsx',
  [
    'import PageLoading from "@/components/BaseComponent/PageLoading.jsx";',
    'export function Page({ loading }: { loading: boolean }) {',
    '  return loading ? PageLoading : <main>Ready</main>;',
    '}',
  ].join('\n'),
  'Imported component PageLoading must be rendered as JSX',
);

assertLintFails(
  'no-direct-imported-component-arrow-return.tsx',
  [
    'import PageLoading from "@/components/BaseComponent/PageLoading.jsx";',
    'export const Page = () => PageLoading;',
  ].join('\n'),
  'Imported component PageLoading must be rendered as JSX',
);

lintSource(
  'allow-reassigned-let.ts',
  'let count = 1;\ncount += 1;\nvoid count;\n',
);

lintSource(
  'allow-descriptive-names.ts',
  'interface Model { title: string }\nconst value: Model = { title: "ok" };\nconst doubleValue = (count: number) => count * 2;\nvoid value.title;\nvoid doubleValue;\n',
);

lintSource(
  'allow-use-effect-listener-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    const onScroll = () => window.scrollY;',
    '    window.addEventListener("scroll", onScroll);',
    '    return () => window.removeEventListener("scroll", onScroll);',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-use-effect-with-body.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    document.title = "Ready";',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-use-callback-with-body.tsx',
  [
    'import { useCallback } from "react";',
    'export function Page() {',
    '  const onClick = useCallback(() => {',
    '    return Date.now();',
    '  }, []);',
    '  return <button onClick={onClick}>Save</button>;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-use-memo-with-body.tsx',
  [
    'import { useMemo } from "react";',
    'export function Page() {',
    '  const value = useMemo(() => {',
    '    return "Ready";',
    '  }, []);',
    '  return <span>{value}</span>;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-imported-component-jsx-return.tsx',
  [
    'import PageLoading from "@/components/BaseComponent/PageLoading.jsx";',
    'export function Page({ loading }: { loading: boolean }) {',
    '  return loading ? <PageLoading /> : <main>Ready</main>;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-imported-component-as-prop.tsx',
  [
    'import PageLoading from "@/components/BaseComponent/PageLoading.jsx";',
    'function Shell({ loadingComponent }: { loadingComponent: unknown }) {',
    '  return <main>{String(Boolean(loadingComponent))}</main>;',
    '}',
    'export function Page() {',
    '  return <Shell loadingComponent={PageLoading} />;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-local-pascal-case-reference.tsx',
  [
    'const PageLoading = "loading";',
    'export function Page({ loading }: { loading: boolean }) {',
    '  return loading ? PageLoading : <main>Ready</main>;',
    '}',
  ].join('\n'),
);

lintSource(
  'allow-use-effect-timer-cleanup.tsx',
  [
    'import { useEffect } from "react";',
    'export function Page() {',
    '  useEffect(() => {',
    '    const timerId = window.setTimeout(() => Date.now(), 1000);',
    '    return () => window.clearTimeout(timerId);',
    '  }, []);',
    '  return null;',
    '}',
  ].join('\n'),
);
