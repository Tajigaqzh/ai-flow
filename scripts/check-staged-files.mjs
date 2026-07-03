/**
 * staged 文件提交前质量检查脚本。
 *
 * 依赖：
 * - Node.js 内置模块：node:fs、node:path、node:url、node:child_process。
 * - Git：通过 `git diff --cached` 获取本次已经暂存的文件。
 * - pnpm：调用项目内的 Prettier、ESLint 和 TypeScript 编译检查。
 *
 * 作用：
 * - 只检查 staged 文件，避免误报未准备提交的本地改动。
 * - 在提交前统一执行格式、lint、编译和补充规则扫描。
 * - 发现阻断问题时返回非 0 退出码，让 commit 中断。
 *
 * 禁止提交：
 * - Prettier 检查失败，例如格式、缩进、分号、空格不统一。
 * - ESLint 检查失败，例如未使用变量、var、显式 any、console/debugger、空函数等。
 * - TypeScript/TSX/JSX 编译检查失败。
 * - 大段被注释掉的代码，包含 JSX 中被注释掉的组件或空 JS 注释。
 * - React 列表 key 使用 `index`、`Math.random()` 或 `Date.now()`。
 * - React 基础可访问性问题：`<img>` 缺少 alt。
 * - 安全问题：`target="_blank"` 缺少 `rel="noreferrer"` 或 `rel="noopener"`。
 *
 * 仅警告不中断：
 * - 单个 staged 文件超过 1000 行。
 * - 函数超过建议行数。
 * - 疑似嵌套三元表达式。
 */
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// 这些后缀会交给 ESLint 检查，覆盖 TS/JS 与 React JSX/TSX 文件。
const lintExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

// 这些后缀一旦出现在应用源码里，就需要触发 TypeScript 编译检查。
const compileExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

// 这些文本类文件会参与“注释代码块”扫描，避免提交被注释掉的旧代码。
const commentScanExtensions = new Set([
  ...lintExtensions,
  '.css',
  '.html',
  '.less',
  '.md',
  '.scss',
]);
// 这些文本类文件会参与模板残留文案扫描，避免提交 Nx 生成模板说明。
const templateTextScanExtensions = new Set([
  ...commentScanExtensions,
  '.mdx',
  '.txt',
]);

// React 相关的手写扫描只处理 JSX/TSX，避免误扫普通 TS/JS 字符串。
const reactScanExtensions = new Set(['.jsx', '.tsx']);
// 复杂度 warning 可以覆盖所有代码文件，但只提示，不参与提交失败判断。
const complexityScanExtensions = new Set(lintExtensions);
// 文件和函数长度阈值都是“建议值”，超过后只提醒开发者考虑拆分。
const maxRecommendedFileLines = 1000;
const maxRecommendedFunctionLines = 80;
const commentedCodeRuleName = 'commented-code';
const yellow = '\u001b[33m';
const reset = '\u001b[0m';

// 统一执行子进程命令；Windows 下通过 shell 兼容 .CMD 脚本。
// 默认捕获输出，只有调用方明确要求时才直接输出到控制台。
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'pipe',
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

function getStagedFiles() {
  // 只检查已经进入暂存区的文件，避免提交钩子误报未参与本次提交的工作区改动。
  const result = run('git', [
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMR',
    '-z',
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to read staged files.');
  }

  return result.stdout
    .split('\0')
    .filter(Boolean)
    .filter((filePath) => existsSync(filePath));
}

function isCodeLikeCommentLine(line) {
  // 去掉注释标记后再判断内容是否像被注释掉的代码，而不是普通说明文字。
  const text = line
    .replace(/^\s*(\/\/|#|\*|\/\*|\*\/)\s?/, '')
    .replace(/\s*\*\/\s*$/, '')
    .trim();

  if (!text) {
    return false;
  }

  return /(;|=>|\{|\}|<\/?[A-Z_a-z][\w.-]*|(^|\s)(const|let|var|function|class|return|import|export|if|for|while|switch|try|catch)\b)/.test(
    text,
  );
}

function buildFinding(filePath, startLine, endLine) {
  return `${filePath}:${startLine}-${endLine} contains a large commented code block`;
}

// 下面几个 build* 方法统一控制控制台输出格式，方便 hook 失败时定位到文件和行号。
function buildJsxCommentFinding(filePath, startLine, endLine) {
  return `${filePath}:${startLine}-${endLine} contains a commented JSX/code block`;
}

function buildReactFinding(filePath, lineNumber, message) {
  return `${filePath}:${lineNumber} ${message}`;
}

function buildComplexityWarning(filePath, lineNumber, message) {
  return `${filePath}:${lineNumber} ${message}`;
}

function buildCommentBypassFinding(filePath, startLine, endLine, reason) {
  return `${filePath}:${startLine}-${endLine} bypassed ${commentedCodeRuleName}: ${reason}`;
}

function buildTemplateTextFinding(filePath, lineNumber, message) {
  return `${filePath}:${lineNumber} ${message}`;
}

function getLineNumber(content, index) {
  // matchAll 只能给出字符下标，这里转换成用户能直接定位的 1-based 行号。
  return content.slice(0, index).split(/\r?\n/).length;
}

export function findTemplateTextFindings(content, filePath = '<inline>') {
  const nxWorkspaceMatch = content.match(
    /^Nx workspace with:\r?\n(?:\r?\n)?apps\/web: Rsbuild \+ React \+ React Router \+ Zustand \+ TailwindCSS \+ antd-mobile\r?\napps\/api: NestJS built with TypeScript \(@nx\/js:tsc\)\r?\nJest tests for both applications$/m,
  );

  if (!nxWorkspaceMatch) {
    return [];
  }

  return [
    buildTemplateTextFinding(
      filePath,
      getLineNumber(content, nxWorkspaceMatch.index ?? 0),
      'contains leftover Nx workspace template text; replace it with project-specific documentation.',
    ),
  ];
}

// 只有 TSX/JSX 文件默认扫描 JSX 注释；测试可以通过 options 强制开关。
function shouldScanJsxComments(filePath, options) {
  return (
    options.scanJsxComments ?? ['.jsx', '.tsx'].includes(extname(filePath))
  );
}

function parseCommentedCodeBypass(line) {
  const match = line.match(
    /staged-check-disable(?:-next-line)?\s+commented-code\s+--\s+(.+?)\s*(?:\*\/\}|\*\/|-->|$)/,
  );

  if (!match) {
    return null;
  }

  const reason = match[1].trim();

  if (!reason) {
    return null;
  }

  return {
    isNextLine: line.includes('staged-check-disable-next-line'),
    reason,
  };
}

function isCommentedCodeBypassEnable(line) {
  return line.includes(`staged-check-enable ${commentedCodeRuleName}`);
}

// JSX 注释形如 `{/* ... */}`，这里先去掉 JSX 外壳，只保留注释内容。
function stripJsxCommentMarkers(line) {
  return line
    .replace(/^.*?\{\/\*/, '')
    .replace(/\*\/\}.*$/, '')
    .replace(/^\s*\*/, '')
    .trim();
}

// 普通文字注释允许存在，例如 `{/*你好*/}`；空注释或包含 JSX/代码特征的
// 注释会被视为问题，例如 `{/*<div />*/}`。
function isProblematicJsxComment(lines) {
  const commentLines = lines.map(stripJsxCommentMarkers);
  const commentText = commentLines.join('\n').trim();

  if (!commentText) {
    return true;
  }

  return commentLines.some(isCodeLikeCommentLine);
}

// 检测连续行注释和块注释中疑似“被注释掉的代码”。
// 同时要求达到行数阈值和代码特征行阈值，用来降低普通说明注释的误报。
export function findLargeCommentedCodeBlocks(
  content,
  filePath = '<inline>',
  options = {},
) {
  const minLines = options.minLines ?? 5;
  const minCodeLikeLines = options.minCodeLikeLines ?? 3;
  const findings = [];
  const bypasses = [];
  const lines = content.split(/\r?\n/);
  const activeBlockBypasses = [];
  const nextLineBypasses = new Map();
  let inBlockComment = false;
  let blockStart = 0;
  let blockLines = [];
  let lineCommentStart = 0;
  let lineCommentLines = [];
  let jsxCommentStart = 0;
  let jsxCommentLines = [];

  function getBypassForRange(startLine, endLine) {
    const nextLineBypass = nextLineBypasses.get(startLine);

    if (nextLineBypass) {
      nextLineBypasses.delete(startLine);
      return nextLineBypass;
    }

    return activeBlockBypasses.find(
      (bypass) => bypass.startLine <= startLine && endLine <= bypass.endLine,
    );
  }

  function pushFindingOrBypass(startLine, endLine, findingBuilder) {
    const bypass = getBypassForRange(startLine, endLine);

    if (bypass) {
      bypasses.push(
        buildCommentBypassFinding(filePath, startLine, endLine, bypass.reason),
      );
      return;
    }

    findings.push(findingBuilder(filePath, startLine, endLine));
  }

  // 连续 `//` 或 `#` 注释需要等遇到非注释行后再统一判断。
  function flushLineComments(endLine) {
    // 连续行注释只有在规模足够且具备明显代码特征时才视为问题。
    if (
      lineCommentLines.length >= minLines &&
      lineCommentLines.filter(isCodeLikeCommentLine).length >= minCodeLikeLines
    ) {
      pushFindingOrBypass(lineCommentStart, endLine, buildFinding);
    }

    lineCommentLines = [];
    lineCommentStart = 0;
  }

  // 块注释同样需要等完整收集到 `*/` 后再判断，避免半段误报。
  function flushBlockComments(endLine) {
    // 块注释复用行注释的判断标准，保证两种注释形式处理一致。
    if (
      blockLines.length >= minLines &&
      blockLines.filter(isCodeLikeCommentLine).length >= minCodeLikeLines
    ) {
      pushFindingOrBypass(blockStart, endLine, buildFinding);
    }

    blockLines = [];
    blockStart = 0;
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    const bypassDirective = parseCommentedCodeBypass(line);

    if (bypassDirective) {
      if (bypassDirective.isNextLine) {
        nextLineBypasses.set(lineNumber + 1, {
          reason: bypassDirective.reason,
        });
      } else {
        activeBlockBypasses.push({
          reason: bypassDirective.reason,
          startLine: lineNumber,
          endLine: Number.POSITIVE_INFINITY,
        });
      }
    }

    if (isCommentedCodeBypassEnable(line)) {
      const activeBypass = activeBlockBypasses.at(-1);

      if (activeBypass) {
        activeBypass.endLine = lineNumber;
      }
    }

    if (shouldScanJsxComments(filePath, options)) {
      // TSX/JSX 中允许普通文字注释，但禁止空注释和被注释掉的 JSX/代码。
      if (line.includes('{/*')) {
        // 记录 JSX 注释起始行，并开始收集可能跨行的注释内容。
        jsxCommentStart = lineNumber;
        jsxCommentLines = [];
      }

      if (jsxCommentStart > 0) {
        jsxCommentLines.push(line);
      }

      if (jsxCommentStart > 0 && line.includes('*/}')) {
        // 单行和多行 JSX 注释都在结束行统一判断，方便输出准确行号。
        if (isProblematicJsxComment(jsxCommentLines)) {
          pushFindingOrBypass(
            jsxCommentStart,
            lineNumber,
            buildJsxCommentFinding,
          );
        }

        jsxCommentStart = 0;
        jsxCommentLines = [];
      }
    }

    if (inBlockComment) {
      // 块注释需要一直收集到结束标记，再整体判断是否像注释代码。
      blockLines.push(line);

      if (trimmed.includes('*/')) {
        inBlockComment = false;
        flushBlockComments(lineNumber);
      }

      return;
    }

    if (trimmed.startsWith('/*')) {
      // 块注释开始前先结束上一段行注释，避免把两种注释形式合并成一个问题。
      flushLineComments(lineNumber - 1);
      inBlockComment = !trimmed.includes('*/');
      blockStart = lineNumber;
      blockLines = [line];

      if (!inBlockComment) {
        flushBlockComments(lineNumber);
      }

      return;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
      if (lineCommentLines.length === 0) {
        lineCommentStart = lineNumber;
      }

      lineCommentLines.push(line);
      return;
    }

    flushLineComments(lineNumber - 1);
  });

  flushLineComments(lines.length);

  if (inBlockComment) {
    flushBlockComments(lines.length);
  }

  if (options.includeBypasses) {
    return {
      bypasses,
      findings,
    };
  }

  return findings;
}

function checkCommentedCode(files) {
  const findings = [];
  const bypasses = [];

  for (const filePath of files) {
    // 只扫描文本代码类文件；未知文件交给 Prettier 的 --ignore-unknown 处理。
    if (!commentScanExtensions.has(extname(filePath))) {
      continue;
    }

    const result = findLargeCommentedCodeBlocks(
      readFileSync(filePath, 'utf8'),
      filePath,
      { includeBypasses: true },
    );

    findings.push(...result.findings);
    bypasses.push(...result.bypasses);
  }

  return {
    bypasses,
    findings,
  };
}

function checkTemplateText(files) {
  return files.flatMap((filePath) => {
    if (!templateTextScanExtensions.has(extname(filePath))) {
      return [];
    }

    return findTemplateTextFindings(readFileSync(filePath, 'utf8'), filePath);
  });
}

export function findReactBlockingIssues(content, filePath = '<inline>') {
  const findings = [];

  // 这里放“明确应该阻断提交”的 React 问题。
  content.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;

    // key={index} 在列表变更时容易导致节点复用错误，提交阶段统一要求使用稳定业务 key。
    if (/key\s*=\s*\{\s*index\s*\}/.test(line)) {
      findings.push(
        buildReactFinding(
          filePath,
          lineNumber,
          'uses key={index}; use a stable business id.',
        ),
      );
    }

    // Math.random()/Date.now() 每次 render 都会生成新 key，导致列表节点被反复销毁重建。
    if (/key\s*=\s*\{\s*(?:Math\.random|Date\.now)\s*\(\s*\)\s*\}/.test(line)) {
      findings.push(
        buildReactFinding(
          filePath,
          lineNumber,
          'uses an unstable key from Math.random() or Date.now(); use a stable business id.',
        ),
      );
    }
  });

  for (const match of content.matchAll(/<img\b[\s\S]*?(?:\/>|>)/g)) {
    const imgTag = match[0];

    // 基础可访问性检查：原生 img 必须提供 alt，装饰图也要显式 alt=""。
    if (!/\balt\s*=/.test(imgTag)) {
      findings.push(
        buildReactFinding(
          filePath,
          getLineNumber(content, match.index ?? 0),
          'has an <img> without alt; add meaningful alt or alt="".',
        ),
      );
    }
  }

  for (const match of content.matchAll(/<a\b[\s\S]*?(?:<\/a>|\/>)/g)) {
    const anchorTag = match[0];

    // 新窗口外链必须带 rel，避免 window.opener 安全风险。
    if (
      /\btarget\s*=\s*["']_blank["']/.test(anchorTag) &&
      !/\brel\s*=\s*["'][^"']*\b(noopener|noreferrer)\b[^"']*["']/.test(
        anchorTag,
      )
    ) {
      findings.push(
        buildReactFinding(
          filePath,
          getLineNumber(content, match.index ?? 0),
          'uses target="_blank" without rel="noreferrer" or rel="noopener".',
        ),
      );
    }
  }

  return findings;
}

export function findReactWarnings() {
  // React warning 只保留非阻断提示；危险 key 统一由 findReactBlockingIssues 硬拦截。
  return [];
}

function checkReactBlockingIssues(files) {
  // 只汇总 staged 中 React 文件的阻断问题，保证提交钩子范围收敛到本次提交。
  return files.flatMap((filePath) => {
    if (!reactScanExtensions.has(extname(filePath))) {
      return [];
    }

    return findReactBlockingIssues(readFileSync(filePath, 'utf8'), filePath);
  });
}

function getReactWarnings(files) {
  // React warning 也只针对 staged 文件输出，避免提示用户未准备提交的本地改动。
  return files.flatMap((filePath) => {
    if (!reactScanExtensions.has(extname(filePath))) {
      return [];
    }

    return findReactWarnings(readFileSync(filePath, 'utf8'), filePath);
  });
}

export function getLargeFileWarnings(files, options = {}) {
  const maxLines = options.maxLines ?? maxRecommendedFileLines;

  return files.flatMap((filePath) => {
    if (!existsSync(filePath)) {
      return [];
    }

    const lineCount = readFileSync(filePath, 'utf8').split(/\r?\n/).length;

    // 超过推荐行数只提示，不阻断提交；用于提醒开发者考虑拆组件、抽 hook 或拆配置。
    if (lineCount <= maxLines) {
      return [];
    }

    return [
      `${filePath} has ${lineCount} lines; consider splitting this file.`,
    ];
  });
}

function getBraceDelta(line) {
  // 简单计算花括号层级，用于估算函数结束位置；先去掉字符串，减少误判。
  const withoutStrings = line
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, '')
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '')
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '');

  return (
    (withoutStrings.match(/\{/g) ?? []).length -
    (withoutStrings.match(/\}/g) ?? []).length
  );
}

function getFunctionName(line) {
  // 只识别常见函数声明和 const 箭头函数，保持规则保守，避免复杂语法误伤。
  const functionDeclaration = line.match(
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
  );

  if (functionDeclaration) {
    return functionDeclaration[1];
  }

  const arrowFunction = line.match(
    /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  );

  if (arrowFunction) {
    return arrowFunction[1];
  }

  return null;
}

export function findComplexityWarnings(
  content,
  filePath = '<inline>',
  options = {},
) {
  // 复杂度检查只输出 warning；它提醒代码可读性风险，但不代表代码一定错误。
  const maxFunctionLines =
    options.maxFunctionLines ?? maxRecommendedFunctionLines;
  const warnings = [];
  const lines = content.split(/\r?\n/);
  let currentFunction = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const ternaryCount = (line.match(/\?/g) ?? []).length;

    // 嵌套三元通常会显著降低 JSX 可读性；这里只警告，避免误伤合法表达式。
    if (ternaryCount >= 2 && line.includes(':')) {
      warnings.push(
        buildComplexityWarning(
          filePath,
          lineNumber,
          'contains nested ternary-like logic; consider extracting variables or components.',
        ),
      );
    }

    if (!currentFunction) {
      const functionName = getFunctionName(line);

      if (functionName && line.includes('{')) {
        currentFunction = {
          name: functionName,
          startLine: lineNumber,
          braceDepth: getBraceDelta(line),
        };

        return;
      }
    }

    if (!currentFunction) {
      return;
    }

    currentFunction.braceDepth += getBraceDelta(line);

    if (currentFunction.braceDepth <= 0) {
      const functionLines = lineNumber - currentFunction.startLine + 1;

      // 函数过长先提示，不阻断提交；实际拆分方式需要结合业务语义判断。
      if (functionLines > maxFunctionLines) {
        warnings.push(
          buildComplexityWarning(
            filePath,
            currentFunction.startLine,
            `${currentFunction.name} has ${functionLines} lines; consider splitting it.`,
          ),
        );
      }

      currentFunction = null;
    }
  });

  return warnings;
}

function getComplexityWarnings(files) {
  // 复杂度 warning 面向所有 staged 代码文件，非代码资源不参与扫描。
  return files.flatMap((filePath) => {
    if (!complexityScanExtensions.has(extname(filePath))) {
      return [];
    }

    return findComplexityWarnings(readFileSync(filePath, 'utf8'), filePath);
  });
}

function runPrettier(files) {
  // Prettier 作为格式化和缩进检查的唯一标准。
  const result = run(
    'pnpm',
    ['exec', 'prettier', '--check', '--ignore-unknown', ...files],
    { stdio: 'inherit' },
  );

  return result.status ?? 1;
}

function runEslint(files) {
  // ESLint 负责语义类质量规则，例如未使用变量、禁止 var、禁止显式 any、
  // 禁止空函数，以及 let/const 合理使用。
  const lintFiles = files.filter((filePath) =>
    lintExtensions.has(extname(filePath)),
  );

  if (lintFiles.length === 0) {
    return 0;
  }

  const result = run(
    'pnpm',
    ['exec', 'eslint', '--max-warnings=0', ...lintFiles],
    { stdio: 'inherit' },
  );

  return result.status ?? 1;
}

export function getCompileChecks(files) {
  const checks = [];
  // 只要本次暂存区包含 web 源码中的 TS/JS 文件，就运行 web 编译检查。
  const hasWebSource = files.some(
    (filePath) =>
      filePath.startsWith('apps/web/src/') &&
      compileExtensions.has(extname(filePath)),
  );
  // API 只包含服务端源码时才运行 API 编译检查，避免无关文件拖慢提交。
  const hasApiSource = files.some(
    (filePath) =>
      filePath.startsWith('apps/api/src/') &&
      compileExtensions.has(extname(filePath)),
  );

  if (hasWebSource) {
    checks.push({
      label: 'web TypeScript compile check',
      args: [
        'exec',
        'tsc',
        '-p',
        'apps/web/tsconfig.app.json',
        '--noEmit',
        '--allowJs',
      ],
    });
  }

  if (hasApiSource) {
    checks.push({
      label: 'api TypeScript compile check',
      args: ['exec', 'tsc', '-p', 'apps/api/tsconfig.app.json', '--noEmit'],
    });
  }

  return checks;
}

function runCompileChecks(files) {
  // 只对本次暂存区涉及到的应用运行编译检查，用来拦截 TSX/JSX/TS/JS
  // 的语法错误和类型编译错误，避免提交后才在构建阶段暴露。
  const checks = getCompileChecks(files);
  let failed = false;

  for (const check of checks) {
    console.log(`Running ${check.label}.`);

    const result = run('pnpm', check.args, { stdio: 'inherit' });

    if ((result.status ?? 1) !== 0) {
      failed = true;
    }
  }

  return failed ? 1 : 0;
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log('✅ No staged files to check.');
    return 0;
  }

  console.log(`🔎 Checking ${stagedFiles.length} staged file(s).`);

  // 先收集并输出所有检查类别的问题，再统一返回失败，方便一次性修复。
  // Findings 是阻断项，会让 commit 失败；Warnings 只提醒，不影响退出码。
  const commentResult = checkCommentedCode(stagedFiles);
  const commentFindings = commentResult.findings;
  const templateTextFindings = checkTemplateText(stagedFiles);
  const reactFindings = checkReactBlockingIssues(stagedFiles);
  const largeFileWarnings = getLargeFileWarnings(stagedFiles);
  const reactWarnings = getReactWarnings(stagedFiles);
  const complexityWarnings = getComplexityWarnings(stagedFiles);

  if (largeFileWarnings.length > 0) {
    console.warn('⚠️ Large staged files detected:');
    for (const warning of largeFileWarnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (reactWarnings.length > 0) {
    console.warn('⚠️ React warnings detected:');
    for (const warning of reactWarnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (complexityWarnings.length > 0) {
    console.warn('⚠️ Complexity warnings detected:');
    for (const warning of complexityWarnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (commentResult.bypasses.length > 0) {
    console.warn(
      `${yellow}⚠️ Commented code bypasses detected (${commentResult.bypasses.length}):${reset}`,
    );
    for (const bypass of commentResult.bypasses) {
      console.warn(`${yellow}- ${bypass}${reset}`);
    }
  }

  if (commentFindings.length > 0) {
    console.error('❌ Large commented code blocks detected:');
    for (const finding of commentFindings) {
      console.error(`- ${finding}`);
    }
  }

  if (templateTextFindings.length > 0) {
    console.error('❌ Template text leftovers detected:');
    for (const finding of templateTextFindings) {
      console.error(`- ${finding}`);
    }
  }

  if (reactFindings.length > 0) {
    console.error('❌ React staged rule violations detected:');
    for (const finding of reactFindings) {
      console.error(`- ${finding}`);
    }
  }

  const prettierStatus = runPrettier(stagedFiles);
  const eslintStatus = runEslint(stagedFiles);
  const compileStatus = runCompileChecks(stagedFiles);

  if (
    commentFindings.length > 0 ||
    templateTextFindings.length > 0 ||
    reactFindings.length > 0 ||
    prettierStatus !== 0 ||
    eslintStatus !== 0 ||
    compileStatus !== 0
  ) {
    return 1;
  }

  console.log('✅ Staged file checks passed. :)');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
