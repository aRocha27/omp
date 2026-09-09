# DEVELOPMENT_GUIDELINES.md

## Mandatory development behavior

These rules apply to every implementation task.

---

# 1. Before coding

For the feature being changed:

1. Read the relevant Access `.cls` files.
2. Read the relevant `report.md` section.
3. Identify confirmed inputs/outputs.
4. Identify unknown behavior.
5. Check the architecture/service contract.
6. Check role/security implications.
7. Define test cases before or alongside implementation.

---

# 2. Do not port VBA line-by-line

Translate the workflow.

Example:

```text
DoCmd.OpenForm
```

becomes navigation.

```text
DLookup
```

eventually becomes API/data access.

```text
MsgBox
```

becomes an appropriate alert/dialog/toast.

```text
Access query concatenation
```

must not become raw SQL string concatenation in the future backend.

---

# 3. Keep unknowns visible

Use comments/docs like:

```text
TODO(source-verification):
Actual database nullability is unknown.
```

or:

```text
Legacy ambiguity:
Access delete recalculation differs from update recalculation.
```

Do not hide uncertainty inside implementation assumptions.

---

# 4. Reuse domain language

Prefer names from the existing application when they carry business meaning:

- Order
- Client
- Recognition
- Warranty
- Revenue
- Backlog
- Factory
- Facturacao

UI copy can be modernized, but domain meaning must remain traceable.

---

# 5. Prefer explicit code

Avoid clever abstractions that make legacy behavior harder to understand.

Business rules should read clearly.

---

# 6. Keep components focused

Pages coordinate.

Feature components present/collect data.

Domain functions calculate.

Repositories retrieve/persist.

Do not combine all responsibilities in a single page component.

---

# 7. Error handling

Never swallow errors.

User-facing failures need a usable state.

Developer errors should contain enough context for debugging without exposing secrets.

---

# 8. Accessibility

Do not postpone basic accessibility.

Use semantic controls from the start.

---

# 9. Tests

Every meaningful bug fix should add a regression test when possible.

Every new business rule should have a logic test.

Every critical user workflow should eventually have a Playwright test.

---

# 10. Documentation updates

Update docs when:

- architecture changes,
- stack changes,
- a legacy ambiguity is resolved,
- a business rule is confirmed,
- a new integration dependency is introduced.

Do not let documentation become historical fiction.

---

# 11. Pull request self-review

Before considering work complete:

- Does this preserve the intended Access workflow?
- Did I invent behavior?
- Is the feature tied directly to mock arrays?
- Does Viewer mode behave correctly?
- Does error/empty/loading work?
- Is there test evidence?
- Will future API integration require rewriting this component?
- Did I introduce any secret/security issue?
