# Repository Guidelines

## Commit 类型参考规范

commit message 的 type 参考以下类型；执行提交时必须从该列表中选择：

- `build`：构建系统或外部依赖相关变更，例如打包配置、构建脚本、依赖版本。
- `chore`：不影响业务逻辑的日常维护变更，例如工具配置、仓库杂项调整。
- `ci`：持续集成相关变更，例如 GitHub Actions、流水线、发布流程配置。
- `docs`：文档变更，例如 README、AGENTS、注释型说明文档。
- `feat`：新增功能或新增用户可见能力。
- `fix`：修复 bug 或纠正错误行为。
- `fork`：分叉、同步上游、适配 fork 分支相关变更。
- `perf`：性能优化，且不改变既有功能行为。
- `refactor`：代码重构，不新增功能也不修复 bug。
- `revert`：回退之前的提交。
- `style`：代码格式、空白、缩进、样式等不影响逻辑的变更。
- `test`：新增或修改测试相关内容。

## 项目结构与模块组织

这是一个 Nx monorepo，主要应用位于 `apps/`。

- `apps/web`：React 19 前端，使用 Rsbuild、Ant Design、React Router、Zustand、Tailwind CSS 和 Less Modules。
- `apps/api`：NestJS 后端服务。
- `apps/web/src/pages`：页面目录，例如 `home/`、`form/`、`table/`、`feedback/`、`not-found/`。每个页面建议使用 `index.tsx` 和 `index.module.less`。
- `apps/web/src/router`：路由配置和 Router 入口。
- `apps/web/src/layout`：应用级布局。
- `apps/web/src/store`：Zustand 状态管理。
- `apps/web/src/tests` 与 `apps/api/src/**/*.spec.ts`：应用内 Jest 单元测试入口或历史就近测试位置；新增页面测试优先按下方 `test/apps/...` 规则组织。
- `e2e`：Playwright 端到端测试。
- `test/apps/...`：按应用源码路径镜像组织的测试，例如页面测试放在 `test/apps/web/src/pages/...`。
- `test/project`：仓库级工具、提交规范、staged 检查等项目治理测试。根目录下不要使用 `test/utils` 命名，避免和前端或后端项目自己的 `utils` 目录、测试目录混淆。
- `test/common`：跨测试复用的 mock、fixture 或测试辅助文件。
- `scripts`：仓库工具脚本，例如复制前端构建产物。

## 构建、测试与本地开发命令

本仓库统一使用 `pnpm`。

- `pnpm dev`：同时启动前端和 API。
- `pnpm dev:web`：启动 React 前端。
- `pnpm dev:api`：启动 NestJS API。
- `pnpm build`：构建 web 和 api，并复制 web 产物。
- `pnpm build:web` / `pnpm build:api`：单独构建某个应用。
- `pnpm test`：运行全部 Jest 测试。
- `pnpm test:web` / `pnpm test:api`：运行指定应用测试。
- `pnpm e2e`：运行 Playwright 测试。
- `pnpm lint`：运行 ESLint 检查。

## 编码风格与命名约定

默认使用 TypeScript。Prettier 配置为单引号。前端源码优先使用 `@/` 路径别名。组件建议使用命名导出。页面目录使用清晰的页面名，文件固定为 `index.tsx` 和 `index.module.less`。CSS Module 类名使用 camelCase，例如 `pageStack`、`formControl`。

## 测试规范

单元测试使用 Jest，浏览器流程测试使用 Playwright。测试文件命名为 `*.spec.ts`、`*.spec.tsx` 或脚本测试约定的 `*.spec.mjs`。

- 测试文件尽量靠近被测代码；页面测试统一放在根目录 `test` 下，并按照前端页面源码路径镜像组织，例如 `apps/web/src/pages/home/index.tsx` 的测试应放在 `test/apps/web/src/pages/home/index.spec.tsx`。
- 前端或后端项目内的 `utils` 相关测试也应按应用源码路径放入镜像目录，例如 `apps/web/src/utils/foo.ts` 对应 `test/apps/web/src/utils/foo.spec.ts`；只有仓库工具、提交规范、staged 检查等项目治理测试放入 `test/project`。
- 每个测试用例方法头必须写注释，说明该用例覆盖的正常场景、异常场景或边界条件。
- 测试必须覆盖正常数据、异常数据和关键边界条件，不能只覆盖 happy path。
- 正常数据至少覆盖 2-3 种代表性场景；异常测试必须覆盖该逻辑可能产生的主要异常类型、无效输入和边界值。
- 修改 store、路由、API service、脚本规则或用户可见流程时，应补充对应测试并执行单文件测试。
- 对页面或组件有任何改动时，必须补充或更新对应测试文件；页面测试按 `test/apps/...` 镜像目录组织，组件测试按所属应用源码路径对应组织。
- e2e 按影响范围选择：涉及前端运行、路由、页面、dev server、Playwright/Rsbuild 配置时必须执行；纯文档或纯脚本规则改动可只执行对应单测和 staged 检查。

## 提交与 Pull Request 规范

提交信息使用简洁的 Conventional Commit 风格，例如 `feat: add not found page`、`fix: update form input addon`，type 参考“Commit 类型参考规范”。PR 应包含变更摘要、已执行的验证命令、相关 issue；涉及 UI 时附截图。

## Agent 注意事项

不要在未确认的情况下覆盖已有贡献文档。修改应保持范围收敛，不回退无关工作区变更。优先沿用现有 Nx、React、Ant Design 和 NestJS 约定，避免引入不必要的新抽象。

## Agent 编码与注释规范

- 始终使用 UTF-8 读取和操作文件，避免中文文档、注释和提交说明出现乱码。
- 当用户明确指定 AI 给整个文件或 TSX 组件加注释时，应在文件头部或组件定义前使用 `/** ... */` 块注释；注释包含四个部分：一段总结性描述，帮助快速理解代码；一段当前文件依赖项；一段当前文件提供的功能；一段核心逻辑流程（非必要，只有逻辑复杂时添加）。
- 当用户明确指定 AI 给代码行或代码块加注释时，应按语义灵活选择 `//` 单行注释或 `/** ... */` 多行注释。给单条语句或状态变量加注释时，优先使用行尾 `//` 注释，说明该语句或状态的用途，例如 `const [strategyInfo, setStrategyInfo] = useState({}); // 策略类型详情`。给方法、复杂代码块或复合逻辑加注释时，建议使用 `/** ... */` 多行注释，说明方法含义、内部实现逻辑和提供的功能。

## staged 检查与绕过规则

- staged 检查默认硬拦截被注释掉的代码；如果用户要求绕过代码,根据代码行数主动选择使用下一行绕过标记或者成对绕过标记。
- 如果用户明确要求 agent 绕过指定行注释代码，使用下一行绕过标记，并必须写明原因：

```tsx
{
  /* staged-check-disable-next-line commented-code -- 临时保留：等待组件接入 */
}
{
  /* <UserName /> */
}
```

- 如果用户明确要求 agent 绕过某一段注释代码字符串，使用成对段落绕过标记，并必须写明原因：

```tsx
{
  /* staged-check-disable commented-code -- 文档页需要展示 JSX 示例 */
}
{
  /*
  <UserName />
  <UserRole />
*/
}
{
  /* staged-check-enable commented-code */
}
```

- 绕过标记只允许用于 `commented-code` 规则；不得用于规避 React Hooks、危险 key、空 `catch {}`、`==`/`!=`、缺少 `alt` 或外链安全 `rel` 等硬性问题。
- 执行 staged 检查时，脚本必须用黄色文字输出已绕过的数量和位置信息，便于审计。
- staged 检查中单个文件超过 1000 行时只输出警告，提醒考虑拆分文件，但不能因此中断 commit。
- staged 检查必须硬拦截 `key={index}`、危险 JSX 注释、缺少 `alt` 的 `<img>`、`target="_blank"` 缺少安全 `rel`、三元表达式中重复调用同一个函数。
- staged 检查和 ESLint 必须硬拦截违反 React Hooks 顶层调用规则、React Hook 依赖数组缺失、`useEffect` 定时器/事件监听/`echarts.init` 缺少有效 cleanup、组件函数体内定义子组件、`key={Math.random()}`、`key={Date.now()}`、`key++`、空 `catch {}`、`==` 和 `!=`。
- staged 检查必须硬拦截 Nx 生成模板残留文案，例如 `Nx workspace with:`、`apps/web: Rsbuild + React ...`、`apps/api: NestJS built with TypeScript ...`、`Jest tests for both applications` 组合出现时，应改成项目真实说明。
- staged 检查中函数过长、疑似嵌套三元表达式只输出复杂度警告，不作为 commit 阻断条件。

## Agent 提交失败处理规则

- 未经用户明确授权，禁止主动删除、修改或“修复”用户代码；即使代码存在 lint、格式化、未使用变量等问题，也只能报告问题并等待用户决定。
- 执行提交时，如果检查失败或 commit 失败，必须立即中断提交流程，不允许为通过检查而自动修改用户代码。
- 提交失败时，必须在最终回复第一行使用明显红色提醒用户，例如 ANSI 红色格式：`\u001b[31m【提交失败】原因摘要\u001b[0m`。如果渲染环境不支持颜色，也必须保留醒目的 `【提交失败】` 前缀。
- 提交失败总结必须列出失败命令、失败文件、关键错误信息，以及“未修改代码、未完成提交”的状态说明。

## 代码修改与测试

- 每次需求改动完毕后都要按“测试规范”补充并执行对应测试。
- 不用每次都执行 build 验证。
- 在用户输入“提交代码”，“commit代码”，“提交”，“推送代码”，“push代码”或其他明确让ai执行git提交和推送操作的时候，必须保证所有修改
  测试通过，代码格式化通过，eslint检查通过，并总结commit信息，commit信息的格式和规范按照下一条约定
- commit 信息必须参考“Commit 类型参考规范”，并包含一条改动总结语句。必须包含改动需求点（或者 bug 修复内容）。必须包含影响文件路径，这些信息按行展示。
- commit 信息中的影响文件只写一次标题，例如 `影响文件:`；后续路径逐行列出，路径行不要重复带 `影响文件:` 前缀。
- 提交成功或失败的最终回复必须列出 staged 检查输出的非阻断警告信息，例如大文件警告、复杂度警告和其他 warning，便于用户审计。
