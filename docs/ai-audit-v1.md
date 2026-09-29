# AI 智能审核 V1 领域基线

来源：[需求讨论与正式 V1 基线](https://chatgpt.com/share/6abb4a1a-e22c-83ea-8256-11ad3bce997f)。本文件把产品边界和交付顺序压缩成仓库内可维护的约束；已实现范围以模块 README 为准。

## 目标与边界

系统围绕文档事实和原文证据完成审核。确定性比较交给客观规则；语义判断交给主观 AI 规则；Agent 负责理解用户意图、生成审核计划并调用业务操作。最终每条结论都应能从 Finding 反查 Rule、Fact、EvidenceNode、DocumentVersion 和原文件位置。

Audit 是一个 JingWei 业务 Module；Project 是其中的业务工作空间。当前设计不按名词数量创建十几个系统 Module。模块内部可以按文档、抽取、规则和运行切分领域代码；只有独立所有权或演进需求得到证明后才考虑拆 Module。

## 核心对象

| 对象                                   | 责任                                       |
| -------------------------------------- | ------------------------------------------ |
| Project                                | 持续存在的审核工作空间，承载文档和多项任务 |
| Document / DocumentVersion             | 逻辑文档与不可覆盖的实际文件版本           |
| DocumentCategory                       | 文档自身是什么类型                         |
| DocumentRole / TaskDocumentBinding     | 文档在某次审核中承担的角色，固定版本       |
| FieldDefinition / CategoryFieldBinding | 标准字段及其在不同文档类别中的抽取提示     |
| DocumentNode / EvidenceNode            | 统一解析结构和稳定的原文证据地址           |
| RetrievalChunk                         | 可重建的检索单元，不能充当证据地址         |
| ExtractedFact                          | 字段值、状态、版本、证据和可选推导过程     |
| AuditTemplate / RuleDefinition         | 版本化的审核需求和客观/主观规则            |
| AuditPlan                              | Agent 或用户提交的待校验执行方案           |
| AuditTask / AuditRun                   | 长期审核事项与某一次不可覆盖的执行         |
| AuditFinding / RuleResult              | 每条规则的状态、输入、证据和类型化展示数据 |

DocumentCategory 描述文件本身，DocumentRole 描述其在当前任务中的用途。Category 指明通常能抽什么；Template 指明本次需要什么。AuditRun 绑定 DocumentVersion 和配置快照，重跑产生新 Run。

## 证据链

PDF 的 SourceRef 至少包含页码及版面框；DOCX 的 SourceRef 至少包含 part、元素路径、可用时的 paraId 和字符范围。解析结果统一成 Canonical Document Model。EvidenceNode 保持稳定；RetrievalChunk 和 LLM Context 可随算法重建。

模型选择 `nodeId + start + end` 后，由服务端校验节点、范围和原文子串，再生成展示引用。模型不能提供未经校验的证据引文。直接事实与由多个事实计算的派生事实分开保存。证据缺失、冲突或 OCR 不确定时返回明确状态，不能伪装成审核失败。

## 执行边界

1. 文档解析后建立结构节点和证据地址；小文档可全文处理，大文档使用结构、关键词、全文、语义等多路召回。
2. 字段抽取按 Extraction Spec 检索、扩展上下文、抽取、验证，并在有预算的重试环内处理失败；输出结构化 Fact。
3. 客观规则通过受限表达式 AST 计算，不执行用户输入的 JavaScript。主观规则通过版本化 rubric、上下文和模型策略产生结构化 Finding。
4. 规则状态至少区分 `PASS`、`FAIL`、`INDETERMINATE`、`NEEDS_REVIEW`、`NOT_APPLICABLE` 和 `ERROR`。
5. 结果按 scalar、comparison、checklist、exceptions、narrative、score 等有限类型呈现；比较表每个值都保留证据引用。
6. 审核运行由确定性状态机持久化、可重试和可取消。Agent 的对话循环、抽取重试循环和审核状态机各自独立。
7. Agent 只通过 Domain Tool 提交并验证 AuditPlan、创建任务、启动 Run、读取进度和解释结果。LLM Provider 与 Agent Runtime 是不同端口；执行长任务后 Agent 立即返回 Run ID。

## 实施顺序

1. Audit 模块内先建立 Project 和版本化配置对象的归属与数据库约束。
2. 实现 DocumentVersion、Canonical Document Model 和 Evidence Viewer，优先证明原文可定位。
3. 实现检索、抽参、服务端证据验证与 Fact 状态。
4. 实现客观规则 DSL、Finding 和类型化结果，再接主观 AI 规则。
5. 完成持久化 Run 状态机、快照、重试、取消、进度和重跑。
6. 最后接入 AuditPlan、Domain Tool 与可替换 Agent Runtime；具体 SDK 仅作为适配器。

当前仓库已实现第 1 步中的 Project，以及第 2 步的基础 Document/DocumentVersion 原文件上传与下载。Canonical Document Model、EvidenceNode 和 Viewer 尚未实现；后续能力仍需逐项实现并测试。
