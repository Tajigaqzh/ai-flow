import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  findComplexityWarnings,
  findLargeCommentedCodeBlocks,
  findReactBlockingIssues,
  findReactWarnings,
  findRepeatedTernaryCallFindings,
  findTemplateTextFindings,
  getCompileChecks,
  getLargeFileWarnings,
} from '../../scripts/check-staged-files.mjs';

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

const nextLineBypassedJsxComment = [
  'export function Page() {',
  '  return (',
  '    <section>',
  '      {/* staged-check-disable-next-line commented-code -- keep legacy sample */}',
  '      {/*',
  '        <LegacyPanel />',
  '      */}',
  '    </section>',
  '  );',
  '}',
].join('\n');

const sameLineBypassedLineComments = [
  '// staged-check-disable commented-code -- keep migration reference',
  '// const value = 1;',
  '// let count = 0;',
  '// function run() {',
  '//   return value + count;',
  '// }',
  '// staged-check-enable commented-code',
].join('\n');

const blockBypassedLineComments = [
  '// staged-check-disable commented-code -- keep long migration reference',
  '// const value = 1;',
  '// let count = 0;',
  '// function run() {',
  '//   return value + count;',
  '// }',
  '// const enabled = true;',
  '// if (enabled) {',
  '//   run();',
  '// }',
  '// staged-check-enable commented-code',
].join('\n');

const inlineBlockBypassedComment = [
  '/* staged-check-disable commented-code -- keep inline reference */ /* const value = 1; */ /* staged-check-enable commented-code */',
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

const nullishAndOptionalSyntax = [
  'function run(options) {',
  "  return options.output?.stdio ?? 'pipe';",
  '}',
].join('\n');

const regexWithQuestionTokens = [
  'const templatePattern =',
  '  /^Nx workspace with:\\r?\\n(?:\\r?\\n)?apps\\/web: Rsbuild \\+ React$/m;',
].join('\n');

const repeatedTernaryCall = [
  'function renderName() {',
  '  return getName() === 1 ? getName() : 2;',
  '}',
].join('\n');

const singleTernaryBranchCall = [
  'function renderName(isReady) {',
  '  return isReady ? getName() : 2;',
  '}',
].join('\n');

const nxWorkspaceTemplateText = [
  'Nx workspace with:',
  '',
  'apps/web: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile',
  'apps/api: NestJS built with TypeScript (@nx/js:tsc)',
  'Jest tests for both applications',
].join('\n');
const nxWorkspaceTemplateTextWithOffset = [
  '# README',
  '',
  'Nx workspace with:',
  'apps/web: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile',
  'apps/api: NestJS built with TypeScript (@nx/js:tsc)',
  'Jest tests for both applications',
].join('\n');
const incompleteNxWorkspaceTemplateTexts = [
  [
    'apps/web: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile',
    'apps/api: NestJS built with TypeScript (@nx/js:tsc)',
    'Jest tests for both applications',
  ].join('\n'),
  [
    'Nx workspace with:',
    'apps/api: NestJS built with TypeScript (@nx/js:tsc)',
    'Jest tests for both applications',
  ].join('\n'),
  [
    'Nx workspace with:',
    'apps/web: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile',
    'Jest tests for both applications',
  ].join('\n'),
  [
    'Nx workspace with:',
    'apps/web: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile',
    'apps/api: NestJS built with TypeScript (@nx/js:tsc)',
  ].join('\n'),
];
const nxWorkspaceTemplateRuleSource = [
  'const nxWorkspaceMatch = content.match(/Nx workspace with:/);',
  "content.includes('apps/web: Rsbuild + React')",
  "content.includes('apps/api: NestJS built with TypeScript')",
  "content.includes('Jest tests for both applications')",
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

const nextLineBypassResult = findLargeCommentedCodeBlocks(
  nextLineBypassedJsxComment,
  'sample.tsx',
  { includeBypasses: true },
);
assert.equal(nextLineBypassResult.findings.length, 0);
assert.deepEqual(nextLineBypassResult.bypasses, [
  'sample.tsx:5-7 bypassed commented-code: keep legacy sample',
]);

const sameLineBypassResult = findLargeCommentedCodeBlocks(
  sameLineBypassedLineComments,
  'sample.ts',
  { includeBypasses: true },
);
assert.equal(sameLineBypassResult.findings.length, 0);
assert.deepEqual(sameLineBypassResult.bypasses, [
  'sample.ts:1-7 bypassed commented-code: keep migration reference',
]);

const blockBypassResult = findLargeCommentedCodeBlocks(
  blockBypassedLineComments,
  'sample.ts',
  { includeBypasses: true },
);
assert.equal(blockBypassResult.findings.length, 0);
assert.deepEqual(blockBypassResult.bypasses, [
  'sample.ts:1-11 bypassed commented-code: keep long migration reference',
]);

const inlineBlockBypassResult = findLargeCommentedCodeBlocks(
  inlineBlockBypassedComment,
  'sample.ts',
  { includeBypasses: true, minCodeLikeLines: 1, minLines: 1 },
);
assert.equal(inlineBlockBypassResult.findings.length, 0);
assert.deepEqual(inlineBlockBypassResult.bypasses, [
  'sample.ts:1-1 bypassed commented-code: keep inline reference',
]);
assert.equal(findReactWarnings(indexKeyList, 'sample.tsx').length, 0);
assert.deepEqual(findReactBlockingIssues(indexKeyList, 'sample.tsx'), [
  'sample.tsx:2 uses key={index}; use a stable business id.',
]);
assert.equal(findReactBlockingIssues(randomKeyList, 'sample.tsx').length, 1);
assert.equal(findReactBlockingIssues(dateNowKeyList, 'sample.tsx').length, 1);
assert.equal(findReactBlockingIssues(imageWithoutAlt, 'sample.tsx').length, 1);
assert.equal(findComplexityWarnings(nestedTernary, 'sample.tsx').length, 1);
assert.equal(
  findComplexityWarnings(nullishAndOptionalSyntax, 'sample.ts').length,
  0,
);
assert.equal(
  findComplexityWarnings(regexWithQuestionTokens, 'sample.ts').length,
  0,
);
assert.deepEqual(
  findRepeatedTernaryCallFindings(repeatedTernaryCall, 'sample.ts'),
  [
    'sample.ts:2 repeats getName() inside a ternary expression; assign it to a variable before the ternary.',
  ],
);
assert.equal(
  findRepeatedTernaryCallFindings(singleTernaryBranchCall, 'sample.ts').length,
  0,
);
assert.deepEqual(
  findTemplateTextFindings(nxWorkspaceTemplateText, 'README.md'),
  [
    'README.md:1 contains leftover Nx workspace template text; replace it with project-specific documentation.',
  ],
);
assert.deepEqual(
  findTemplateTextFindings(nxWorkspaceTemplateTextWithOffset, 'README.md'),
  [
    'README.md:3 contains leftover Nx workspace template text; replace it with project-specific documentation.',
  ],
);

for (const incompleteTemplateText of incompleteNxWorkspaceTemplateTexts) {
  assert.deepEqual(
    findTemplateTextFindings(incompleteTemplateText, 'README.md'),
    [],
  );
}
assert.deepEqual(
  findTemplateTextFindings(nxWorkspaceTemplateRuleSource, 'scripts/check.mjs'),
  [],
);

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
