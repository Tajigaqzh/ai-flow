# ai-flow

Nx workspace with:

- `apps/web`: Rsbuild + React + React Router + Zustand + TailwindCSS + antd-mobile
- `apps/api`: NestJS built with TypeScript (`@nx/js:tsc`)
- Jest tests for both applications

## Scripts

```sh
pnpm dev        # start web
pnpm dev:web
pnpm dev:api
pnpm build
pnpm test
pnpm lint
```

## Projects

```sh
pnpm nx show projects
pnpm nx show project web
pnpm nx show project api
```
