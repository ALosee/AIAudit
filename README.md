# AIAudit / AI 智能审核

AIAudit is an independent repository built on a source snapshot of the [JingWei framework](https://github.com/ALosee/JingWei). It reuses JingWei's tenant, identity, permission, navigation and application infrastructure while developing the AI audit business module here. The baseline snapshot is JingWei commit `1132d03eab7e09ba475067674298c0cf513a6895`; this repository has its own Git history and remote.

The repository contains the JingWei platform foundation and the AIAudit business module. The first delivered audit feature is the project workspace. The full scope and actual progress are tracked in [AI audit V1](./docs/ai-audit-v1.md) and the [implementation map](./docs/ai-audit-implementation-map.md). Framework changes and future upstream synchronization are reviewed explicitly in this repository; no AIAudit changes are pushed to JingWei.

## Requirements

- Node.js 24 LTS or newer
- pnpm 10
- PostgreSQL 18 for migrations and runtime integration

## Commands

```bash
pnpm install
pnpm edition:generate development
pnpm migration:up
DEV_ADMIN_PASSWORD='<至少 12 个字符>' pnpm seed:dev
pnpm seed:navigation
pnpm dev
# 仅在需要使用仓库根目录 .env.test 联调时：
pnpm dev:test

pnpm typecheck
pnpm lint
pnpm format:check
pnpm architecture:check
pnpm test
TEST_ADMIN_PASSWORD='<开发管理员密码>' pnpm test:auth:real
pnpm test:navigation:real
pnpm build
```

Local infrastructure can be started with `docker compose -f docker-compose.dev.yml up -d`. Database migrations use `pnpm migration:status` and `pnpm migration:up` after generating the target Edition.

Production tenant lifecycle is managed at `/platform/tenants` with a separate platform administrator identity. After migrations, create the first operator once with `PLATFORM_OPERATOR_PASSWORD='<至少 12 个字符>' pnpm platform:bootstrap --login platform-admin --name 平台管理员`, then open `/platform/login`. The older `pnpm tenant:manage` command remains a recovery adapter. See [Control Plane](./packages/platform/control-plane/README.md), [ADR 0017](./docs/adr/0017-own-tenant-lifecycle-in-platform-tenancy.md) and [ADR 0018](./docs/adr/0018-separate-platform-control-plane.md).

`pnpm dev` uses the repository-level `.env`, `.env.local`, `.env.development`, and `.env.development.local` files. `.env.test` is intentionally isolated from normal development and is loaded by `pnpm dev:test` only. Environment files are ignored by Git except for `.env.example`.

Migration/seed/test commands require explicitly supplied environment variables. For the local `.env.test` database, see the [exact initialization commands](./tooling/migration/README.md#显式使用-envtest). `seed:navigation` preserves existing passwords and published configuration; `seed:dev` updates the development password. Navigation bootstrap now reads a published database version and returns 503 until one exists.

## Documentation

Code quality uses ESLint; formatting and import sorting use Oxfmt. Run `pnpm lint:fix` for lint fixes and `pnpm format` for formatting. `pnpm check` runs all local quality gates, including the read-only formatting check. See the [formatting and editor setup](./docs/development-guide.md#14-lint格式化与导入排序).

Start at the [documentation center](./docs/README.md). It provides reading paths and detailed guides for:

- Product → Edition → Module → Capability → Permission → Data Scope;
- repository and module boundaries;
- server/web runtime lifecycle;
- current HTTP and TypeScript APIs;
- database, authentication, authorization, navigation and outbox design;
- development, testing, deployment and troubleshooting.

Every app, platform package, business module and tooling package has a nearby README documenting its responsibilities, public API, invariants and current implementation status. Read [AGENTS.md](./AGENTS.md) before making changes; it contains mandatory engineering rules.
