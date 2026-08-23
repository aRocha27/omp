# Architecture Decision Records

Use this directory for decisions that materially affect the project.

File format:

```text
0001-decision-name.md
0002-decision-name.md
...
```

Suggested template:

```md
# ADR-XXXX: Title

## Status
Proposed | Accepted | Superseded

## Context

What problem are we solving?

## Decision

What was chosen?

## Alternatives considered

What else was considered?

## Consequences

What becomes easier/harder?

## References

Relevant source files or project docs.
```

Likely ADRs:

- existing database remains system of record
- React + TypeScript frontend
- Vite build tooling
- repository/service abstraction for mock-to-API transition
- production authentication provider
- future backend framework
- data-access strategy
- email delivery mechanism
- report-generation strategy
