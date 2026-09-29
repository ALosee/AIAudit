# ADR 0022: AI Audit Owns Its Project and Review Lifecycle

- Status: Accepted for the AI audit product work
- Date: 2026-09-29

## Context

JingWei originally delivered only Platform Foundation. The AI audit product now needs a business module for evidence-grounded document review. The first implementation attempt treated Project as its own top-level Module. That boundary is too narrow: an audit project is the long-lived workspace that contains audit documents, tasks and runs. It does not have an independent product lifecycle or external owner.

## Decision

- Add one `audit` business Module to the development and full Editions. This is the explicit product extension to the earlier Foundation-only baseline for this repository.
- Audit owns Project, Document/DocumentVersion, evidence and retrieval representations, field and category configuration, AuditTemplate, RuleDefinition, AuditPlan, AuditTask, AuditRun, ExtractedFact, AuditFinding and typed results. These are domain objects and internal feature areas, not separate JingWei Modules by default.
- The first delivered slice is Project, stored in `audit.project` and exposed under `/api/v1/audit/projects`. Its permissions and route keys carry the `audit` prefix.
- Keep interfaces for parser, search, LLM and Agent Runtime at the relevant Audit application boundaries as those capabilities are implemented. Adapter choice must not determine domain ownership.
- Split a future capability into a separate Module only after an ADR establishes distinct ownership, evolution, authorization or deployment needs. No speculative cross-module event or outbox contract is added.
- Preserve the existing Platform Foundation and its module boundaries. Audit consumes IAM's public access contract and the platform audit writer.

## Consequences

Audit's schema and module can grow, but internal features must remain independently understandable; a single module does not justify a monolithic service class. Project is not a generic project-management product. Old AuditRuns must eventually pin document, rule, field, parser and model versions to make findings reproducible. Current code only delivers Project, so extraction and review outcomes are not yet available.
