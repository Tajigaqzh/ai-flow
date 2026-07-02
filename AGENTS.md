# Repository Guidelines

## Commit 类型限制

commit message 的 type 只允许使用以下类型：

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
- `apps/web/src/tests` 与 `apps/api/src/**/*.spec.ts`：Jest 单元测试。
- `e2e`：Playwright 端到端测试。
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

单元测试使用 Jest，浏览器流程测试使用 Playwright。测试文件命名为 `*.spec.ts` 或 `*.spec.tsx`，尽量靠近被测代码。修改 store、路由、API service 或用户可见流程时，应补充对应测试。较大改动提交前运行 `pnpm test` 和 `pnpm e2e`。

## 提交与 Pull Request 规范

当前 Git 历史只有 initial commit，暂无强制提交规范。建议使用简洁的 Conventional Commit 风格，例如 `feat: add not found page`、`fix: update form input addon`。PR 应包含变更摘要、已执行的验证命令、相关 issue；涉及 UI 时附截图。

## Agent 注意事项

不要在未确认的情况下覆盖已有贡献文档。修改应保持范围收敛，不回退无关工作区变更。优先沿用现有 Nx、React、Ant Design 和 NestJS 约定，避免引入不必要的新抽象。

## Agent 文件编码与 staged 绕过标记

- 始终使用 UTF-8 读取和操作文件，避免中文文档、注释和提交说明出现乱码。
- staged 检查默认硬拦截被注释掉的代码；如果用户明确要求 agent 绕过指定行注释代码，使用下一行绕过标记，并必须写明原因：

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

## Agent 提交失败处理规则

- 未经用户明确授权，禁止主动删除、修改或“修复”用户代码；即使代码存在 lint、格式化、未使用变量等问题，也只能报告问题并等待用户决定。
- 执行提交时，如果检查失败或 commit 失败，必须立即中断提交流程，不允许为通过检查而自动修改用户代码。
- staged 检查中单个文件超过 1000 行时只输出警告，提醒考虑拆分文件，但不能因此中断 commit。
- staged 检查中 `key={index}` 只输出警告，不作为 commit 阻断条件；危险 JSX 注释、缺少 `alt` 的 `<img>`、`target="_blank"` 缺少安全 `rel` 才作为阻断问题。
- staged 检查和 ESLint 必须硬拦截违反 React Hooks 顶层调用规则、`key={Math.random()}`、`key={Date.now()}`、空 `catch {}`、`==` 和 `!=`。
- staged 检查中函数过长、疑似嵌套三元表达式只输出复杂度警告，不作为 commit 阻断条件。
- 提交失败时，必须在最终回复第一行使用明显红色提醒用户，例如 ANSI 红色格式：`\u001b[31m【提交失败】原因摘要\u001b[0m`。如果渲染环境不支持颜色，也必须保留醒目的 `【提交失败】` 前缀。
- 提交失败总结必须列出失败命令、失败文件、关键错误信息，以及“未修改代码、未完成提交”的状态说明。

## 代码修改与测试

- 每次需求改动完毕后都要写对应的测试文件，并执行单文件测试和e2e测试。
- 不用每次都执行build验证。
- 在用户输入“提交代码”，“commit代码”，“提交”，“推送代码”，“push代码”或其他明确让ai执行git提交和推送操作的时候，必须保证所有修改
  测试通过，代码格式化通过，eslint检查通过，并总结commit信息，commit信息的格式和规范按照下一条约定
- commit信息必须包含[## Commit 类型限制]，必须符合其中的规范，必须包含一条改动总结语句。必须包含改动需求点（或者bug修复内容）。必须包含影响文件路径，这些信息按行展示
