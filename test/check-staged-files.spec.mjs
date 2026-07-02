import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findComplexityWarnings,
  findLargeCommentedCodeBlocks,
  findReactBlockingIssues,
  findReactWarnings,
  getCompileChecks,
  getLargeFileWarnings,
} from '../scripts/check-staged-files.mjs';

const commentedCode = [
  '// const value = 1;',
  '// let count = 0;',
  '// function run() {',
  '//   return value + count;',
  '// }',
].join('\n');

const normalComment = `
// This module keeps the pre-commit check focused on staged files.
// Keep the wording direct so hook failures are easy to understand.
// The checks intentionally delegate formatting and linting to existing tools.
`;

const blockCommentedCode = [
  '/*',
  ' * const enabled = true;',
  ' * if (enabled) {',
  ' *   run();',
  ' * }',
  ' */',
].join('\n');

const jsxReturnComment = [
  'export function Page() {',
  '  return (',
  '    <section>',
  '      {/* <LegacyPanel /> */}',
  '    </section>',
  '  );',
  '}',
].join('\n');

const emptyJsxReturnComment = [
  'export function Page() {',
  '  return <section>{/* */}</section>;',
  '}',
].join('\n');

const multilineJsxReturnComment = [
  'export function Page() {',
  '  return (',
  '    <section>',
  '      {/*',
  '        <LegacyPanel />',
  '      */}',
  '    </section>',
  '  );',
  '}',
].join('\n');

const conditionalJsxComment = [
  'export function Page({ topButtonVisible }) {',
  '  return (',
  '    <main>',
  '      {topButtonVisible && (',
  "        <div className='topButton'>",
  '          {/*<VerticalAlignTopOutlined />*/}',
  '          <img src="/topArrow.png" />',
  '        </div>',
  '      )}',
  '    </main>',
  '  );',
  '}',
].join('\n');

const plainJsxComment = [
  'export function Page() {',
  '  return (',
  '    <section>',
  '      {/*你好*/}',
  '      <span>内容</span>',
  '    </section>',
  '  );',
  '}',
].join('\n');

const multipleCommentedJsxLines = [
  'export function Page() {',
  '  return (',
  '    <section>',
  '      {/*<div>*/}',
  '      {/*  <span>111</span>*/}',
  '      {/*  <span>111</span>*/}',
  '      {/*  <span>111</span>*/}',
  '      {/*  <span>111</span>*/}',
  '      {/*</div>*/}',
  '    </section>',
  '  );',
  '}',
].join('\n');

const indexKeyList = [
  'export function Page({ items }) {',
  '  return items.map((item, index) => <div key={index}>{item.name}</div>);',
  '}',
].join('\n');

const randomKeyList = [
  'export function Page({ items }) {',
  '  return items.map((item) => <div key={Math.random()}>{item.name}</div>);',
  '}',
].join('\n');

const dateNowKeyList = [
  'export function Page({ items }) {',
  '  return items.map((item) => <div key={Date.now()}>{item.name}</div>);',
  '}',
].join('\n');

const imageWithoutAlt = [
  'export function Page() {',
  '  return <img src="/logo.png" />;',
  '}',
].join('\n');

const nestedTernary = [
  'export function Page({ status }) {',
  "  return status === 'success' ? <Success /> : status === 'error' ? <Error /> : <Loading />;",
  '}',
].join('\n');

assert.equal(
  findLargeCommentedCodeBlocks(commentedCode, 'sample.ts').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(normalComment, 'sample.ts').length,
  0,
);
assert.equal(
  findLargeCommentedCodeBlocks(blockCommentedCode, 'sample.ts').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(jsxReturnComment, 'sample.tsx').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(emptyJsxReturnComment, 'sample.tsx').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(multilineJsxReturnComment, 'sample.jsx').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(conditionalJsxComment, 'sample.tsx').length,
  1,
);
assert.equal(
  findLargeCommentedCodeBlocks(plainJsxComment, 'sample.tsx').length,
  0,
);
assert.equal(
  findLargeCommentedCodeBlocks(multipleCommentedJsxLines, 'sample.tsx').length,
  6,
);
assert.equal(findReactWarnings(indexKeyList, 'sample.tsx').length, 1);
assert.equal(findReactBlockingIssues(indexKeyList, 'sample.tsx').length, 0);
assert.equal(findReactBlockingIssues(randomKeyList, 'sample.tsx').length, 1);
assert.equal(findReactBlockingIssues(dateNowKeyList, 'sample.tsx').length, 1);
assert.equal(findReactBlockingIssues(imageWithoutAlt, 'sample.tsx').length, 1);
assert.equal(findComplexityWarnings(nestedTernary, 'sample.tsx').length, 1);

assert.deepEqual(
  getCompileChecks(['apps/web/src/App.tsx']).map((check) => check.label),
  ['web TypeScript compile check'],
);

assert.deepEqual(
  getCompileChecks(['apps/web/src/legacy.jsx']).map((check) => check.label),
  ['web TypeScript compile check'],
);

assert.deepEqual(
  getCompileChecks(['apps/api/src/main.ts']).map((check) => check.label),
  ['api TypeScript compile check'],
);

assert.deepEqual(getCompileChecks(['AGENTS.md']), []);

const largeFileTestDir = mkdtempSync(join(tmpdir(), 'staged-check-'));
try {
  const thousandLineFile = join(largeFileTestDir, 'thousand.ts');
  const thousandOneLineFile = join(largeFileTestDir, 'thousand-one.ts');

  writeFileSync(
    thousandLineFile,
    Array(1000).fill('const value = 1;').join('\n'),
  );
  writeFileSync(
    thousandOneLineFile,
    Array(1001).fill('const value = 1;').join('\n'),
  );

  assert.deepEqual(
    getLargeFileWarnings([thousandLineFile], { maxLines: 1000 }),
    [],
  );
  assert.equal(
    getLargeFileWarnings([thousandOneLineFile], { maxLines: 1000 }).length,
    1,
  );
} finally {
  rmSync(largeFileTestDir, { force: true, recursive: true });
}
