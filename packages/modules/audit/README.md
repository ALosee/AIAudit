# AI 智能审核模块

包：`@jingwei/module-audit`；模块 ID：`audit`；类别：`business`；依赖：`iam`。

Audit 是面向文档审核的一条完整业务边界。Project 是审核工作空间，不是独立的系统 Module。本模块逐步拥有项目、文档及版本、证据、字段、抽取、规则、模板、任务、运行和结构化结果。Agent 将来只通过 Audit 提供的业务操作协议创建计划和启动审核，不直接写内部表。

整体领域设计见 [AI 审核平台 V1](../../../docs/ai-audit-v1.md) 与 [ADR 0022](../../../docs/adr/0022-own-ai-audit-in-one-module.md)。

## 当前实现

首个纵向切片是 Project：可分页查看、创建、修改和归档。Project 属于租户，不是平台租户本身，也不是 Navigation 的分类。归档保留历史，不物理删除。文档、抽参、规则、审核任务和 Agent 尚未实现，不应把当前项目页当成可执行审核入口。

## Manifest 与权限

- capability：`audit.projects`；
- permission：`audit.project.view`、`audit.project.manage`；
- route：`audit.projects` → `ProjectList`，必须具备 view 权限；
- 导航：`/audit/projects`，挂在工作区下。

IAM 通过公开授权 API 提供权限检查。当前 Project 列表是租户内共享工作区，所有具备相应权限的用户可访问本租户项目；未来项目成员和项目级数据范围需要专门设计，不能把此权限误当成成员授权。

## 数据所有权

`audit.project` 存储项目名称、描述、状态、revision 和创建/修改人、时间。每次查询与写入均限定 `tenant_id`。Project 使用 UUID v7，`revision` 用于乐观并发。模块迁移在 `migrations/20260929090000_audit_project_foundation.ts`。

文档、规则和任务后续仍由 Audit 拥有，但各自会在模块内部使用独立的 domain/application/infrastructure 代码及数据库表，不把所有流程塞进 Project 用例。

## HTTP 与客户端

路径前缀 `/api/v1/audit`：

| 方法  | 路径                     | 作用             |
| ----- | ------------------------ | ---------------- |
| GET   | `/projects`              | 按状态分页读取   |
| GET   | `/projects/{id}`         | 读取项目         |
| POST  | `/projects`              | 创建项目         |
| PATCH | `/projects/{id}`         | 按 revision 修改 |
| POST  | `/projects/{id}/archive` | 按 revision 归档 |

外部输入经 Zod/OpenAPI 校验，客户端由模块专属 `paths` 类型与 Soybean Fetch 构建。写操作由 Application 在同一事务内写入 Project 和 append-only 审计记录。稳定错误码：`PROJECT_NOT_FOUND`、`PROJECT_REVISION_CONFLICT`、`PROJECT_ARCHIVED`。

## Public API 与事件

当前没有其他业务 Module 需要 Project 的同步查询，因此 `server/public` 暂不导出业务 API；没有真实事件消费者，因此不发 Integration Event 或 Outbox 消息。后续文档/任务在同一个 Audit Module 内部协作，不需要跨模块接口。

## 代码结构

- `src/shared`：Project API schema 和类型；
- `src/server/application`：项目用例、授权需求和存储 port；
- `src/server/infrastructure`：Kysely 存储和事务审计；
- `src/server/api`：路由与 OpenAPI 契约；
- `src/client`：模块专属类型化客户端；
- `src/web/composables`：列表、编辑与反馈流程；
- `src/web/pages`：项目工作区展示；
- `migrations`：Audit 所有的数据库变更。

变更后运行仓库根目录 `pnpm check`。数据库联调还需 PostgreSQL 18、迁移和一个具备 Audit 权限的租户账号。
