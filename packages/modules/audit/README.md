# AI 智能审核模块

包：`@jingwei/module-audit`；模块 ID：`audit`；类别：`business`；依赖：`iam`。

Audit 是面向文档审核的一条完整业务边界。Project 是审核工作空间，不是独立的系统 Module。本模块逐步拥有项目、文档及版本、证据、字段、抽取、规则、模板、任务、运行和结构化结果。Agent 将来只通过 Audit 提供的业务操作协议创建计划和启动审核，不直接写内部表。

整体领域设计见 [AI 审核平台 V1](../../../docs/ai-audit-v1.md) 与 [ADR 0022](../../../docs/adr/0022-own-ai-audit-in-one-module.md)。

## 当前实现

已实现 Project、基础文档版本和任务文档输入切片。Project 可分页查看、创建、修改和归档。项目内可上传 PDF/DOCX 文档、追加不可覆盖的版本、查看历史并获取 60 秒短期下载地址。项目内可创建、修改审核任务，将同项目文档的指定版本按任务角色绑定或撤销；同一文档可供多个任务使用。任务页也可上传新文档并绑定首版。归档项目保留历史且禁止修改。文档解析、EvidenceNode、OCR、抽参、规则、可执行 AuditPlan、AuditRun 和 Agent 尚未实现，当前任务仅处于输入配置阶段，不能执行审核。

## Manifest 与权限

- capability：`audit.projects`、`audit.tasks`；
- permission：`audit.project.view`、`audit.project.manage`、`audit.task.view`、`audit.task.manage`；
- route：`audit.projects` → `ProjectList`，必须具备 view 权限；
- 导航：`/audit/projects`，挂在工作区下。

IAM 通过公开授权 API 提供权限检查。当前 Project 列表是租户内共享工作区，所有具备相应权限的用户可访问本租户项目；未来项目成员和项目级数据范围需要专门设计，不能把此权限误当成成员授权。

## 数据所有权

`audit.project` 存储项目名称、描述、状态、revision 和创建/修改人、时间。`audit.document` 属于 Project，`audit.document_version` 保存不可覆盖的版本号、原文件名、格式、字节数、SHA-256、对象 key 和时间，`20260929132000_audit_document_version_immutable.ts` 在数据库层拒绝版本 UPDATE/DELETE。`audit.task` 属于 Project，保存名称、审核目标、`DRAFT` 状态和乐观锁 revision；`audit.task_document_binding` 同时固定任务、项目文档、文档版本及任务角色。复合外键防止跨租户、跨项目及版本错配。撤销绑定只标记 removed，保留历史；有效绑定按任务、文档和角色唯一。每次查询与写入均限定 `tenant_id`；版本 API 不暴露对象 key。Project、Document、Task 和绑定使用 UUID v7。任务迁移为 `20260929130000_audit_task_document_binding.ts` 与 `20260929131000_audit_task_draft_status.ts`，承接已有 Project 和 DocumentVersion 迁移。

文档、规则和任务均由 Audit 拥有；任务用例独立于 Project 用例。此阶段允许人工创建不可执行的任务草稿以配置目标和输入；真正启动 Run 前仍需可验证的 AuditPlan、规则配置和证据链。

## HTTP 与客户端

路径前缀 `/api/v1/audit`：

| 方法      | 路径                                                                         | 作用                   |
| --------- | ---------------------------------------------------------------------------- | ---------------------- |
| GET       | `/projects`                                                                  | 按状态分页读取         |
| GET       | `/projects/{id}`                                                             | 读取项目               |
| POST      | `/projects`                                                                  | 创建项目               |
| PATCH     | `/projects/{id}`                                                             | 按 revision 修改       |
| POST      | `/projects/{id}/archive`                                                     | 按 revision 归档       |
| GET       | `/projects/{projectId}/documents`                                            | 列出文档               |
| POST      | `/projects/{projectId}/documents`                                            | 上传文档及首版         |
| GET       | `/projects/{projectId}/documents/{documentId}/versions`                      | 列出版本               |
| POST      | `/projects/{projectId}/documents/{documentId}/versions`                      | 上传新版本             |
| GET       | `/projects/{projectId}/documents/{documentId}/versions/{versionId}/download` | 授权后签发短期下载地址 |
| GET/POST  | `/projects/{projectId}/tasks`                                                | 列出或创建任务         |
| GET/PATCH | `/projects/{projectId}/tasks/{taskId}`                                       | 读取或修改任务         |
| GET/POST  | `/projects/{projectId}/tasks/{taskId}/documents`                             | 列出或绑定指定文档版本 |
| POST      | `/projects/{projectId}/tasks/{taskId}/documents/{bindingId}/unbind`          | 撤销任务绑定           |

外部输入经 Zod/OpenAPI 校验，文档文件的 Domain 校验只产生失败原因，由 Application 映射为稳定错误码和 HTTP 状态；客户端由模块专属 `paths` 类型与 Soybean Fetch 构建。项目和任务写操作在事务内写入业务数据与 append-only 审计记录；文档先写对象，再在同一数据库事务内写文档/版本元数据与审计，事务失败时补偿删除对象。签发下载地址也记录文档版本审计，但不记录签名 URL。任务 API 要求 `audit.task.view/manage` 和 `audit.project.view`，文档 API 使用 `audit.project.view/manage`。任务绑定必须属于同一租户和项目，且版本属于指定文档；任务 revision 覆盖任务资料和绑定变化。任务资料审计记录变更字段及字段哈希，不记录完整审核目标。任务内“上传并绑定”由客户端顺序调用上传和绑定；若绑定失败，已上传版本保留在项目文档库，界面可刷新任务 revision 后重试绑定该版本，或明确选择只保留在项目库。稳定错误码另包括 `TASK_NOT_FOUND`、`TASK_REVISION_CONFLICT`、`TASK_DOCUMENT_BINDING_NOT_FOUND`、`TASK_DOCUMENT_BINDING_CONFLICT`、`DOCUMENT_VERSION_NOT_FOUND`。

## Public API 与事件

当前没有其他业务 Module 需要 Project 的同步查询，因此 `server/public` 暂不导出业务 API；没有真实事件消费者，因此不发 Integration Event 或 Outbox 消息。后续文档/任务在同一个 Audit Module 内部协作，不需要跨模块接口。

## 代码结构

- `src/shared`：Project、Document 和 Task API schema 和类型；
- `src/server/application`：项目、文档与任务用例、授权需求和存储 port；
- `src/server/infrastructure`：Kysely 存储和事务审计；
- `src/server/api`：路由与 OpenAPI 契约；
- `src/client`：模块专属类型化客户端；
- `src/web/composables`：列表、编辑与反馈流程；
- `src/web/pages`：项目工作区展示；
- `migrations`：Audit 所有的数据库变更。

变更后运行仓库根目录 `pnpm check`。本地联调需要 PostgreSQL 18、迁移、具备 Audit 权限的账号，以及外部 RustFS Bucket 和 `OBJECT_STORAGE_*` 环境变量。当前上传上限 20 MiB，采用内存缓冲；更大文件需要流式契约。生产开放不可信上传前须实现病毒扫描与隔离。
