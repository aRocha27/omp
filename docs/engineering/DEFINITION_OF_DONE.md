# DEFINITION_OF_DONE.md

## Purpose

A feature is not complete because it visually appears finished.

A feature is complete when the required evidence exists for the current project phase.

---

# 1. Current UI-phase Definition of Done

A frontend feature is done when:

- [ ] Relevant Access source/report documentation was reviewed.
- [ ] Confirmed behavior is distinguished from provisional design.
- [ ] TypeScript types exist.
- [ ] Data access goes through a repository/service contract.
- [ ] No component reads raw fixture arrays as its permanent architecture.
- [ ] Viewer/Editor/Admin behavior is considered.
- [ ] Loading state exists.
- [ ] Empty state exists.
- [ ] Error state exists.
- [ ] Success state exists where relevant.
- [ ] Form validation exists where relevant.
- [ ] Keyboard/accessibility behavior is acceptable.
- [ ] Unit/business-rule tests exist where logic is present.
- [ ] Component tests exist for important UI behavior.
- [ ] Playwright covers the critical workflow when appropriate.
- [ ] TypeScript compiles with no blocking errors.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] No production secrets were introduced.
- [ ] Documentation is updated if behavior/architecture changed.
- [ ] Unknown database behavior remains marked as unknown.

---

# 2. Additional Definition of Done for sensitive UI

For:

- Recognition
- Invoice email
- Stock mutations
- Admin maintenance
- Close Deals

also require:

- [ ] confirmation/validation UX is explicit,
- [ ] permission UX is tested,
- [ ] action cannot be accidentally triggered by ordinary navigation,
- [ ] mock action makes clear when real backend behavior is not yet implemented.

---

# 3. What does not qualify as done

Not sufficient:

- “looks correct,”
- “works on my machine,”
- a screenshot only,
- a component with hardcoded mock data,
- a happy-path-only implementation,
- hidden buttons without permission architecture,
- comments saying backend will handle it later with no contract.

---

# 4. Future integration Definition of Done

Once the real backend/database exists, a data feature additionally requires:

- [ ] database/API mapping verified,
- [ ] integration tests,
- [ ] server authorization tests,
- [ ] input validation on backend,
- [ ] transaction behavior verified,
- [ ] audit behavior verified where required,
- [ ] Access parity/characterization test where applicable,
- [ ] error mapping tested,
- [ ] no production-only manual steps undocumented.

---

# 5. Production Definition of Done

Before production:

- [ ] UAT approved,
- [ ] security review passed,
- [ ] critical accessibility issues resolved,
- [ ] performance accepted,
- [ ] observability/logging exists,
- [ ] rollback plan exists,
- [ ] deployment documented,
- [ ] operational ownership defined.
