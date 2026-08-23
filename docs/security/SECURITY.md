# SECURITY.md

## Security status

Current phase: **frontend/UI development without the production database**.

Therefore security must be designed now, but some controls cannot be proven until the backend/integration phase.

Never describe frontend role simulation as production authorization.

---

# 1. Security objectives

The final application must protect:

- customer information,
- orders,
- invoices,
- revenue-recognition data,
- stock data,
- administrative master data,
- user permissions,
- report outputs,
- email actions.

---

# 2. Authentication

Planned direction:

- enterprise identity, likely Microsoft Entra ID.

Current development:

- deterministic mock user/role provider.

The UI must not assume a specific token format or authentication SDK in domain logic.

---

# 3. Authorization

Confirmed legacy concepts:

- read-only/viewer,
- editor,
- administrator.

Frontend should reflect these states for UX.

Future backend must independently authorize every mutation.

Examples:

```text
Viewer
- read permitted
- mutation denied

Editor
- normal business mutations permitted
- admin operations denied

Administrator
- admin maintenance and approved privileged actions permitted
```

Exact endpoint permissions must be documented when the backend exists.

---

# 4. No frontend trust

Never trust values because the browser sent them.

Future backend must validate:

- record identifiers,
- money amounts,
- dates,
- recognition type,
- role/permission,
- report filters,
- email targets,
- stock operations.

---

# 5. SQL safety

The Access VBA often constructs SQL with string concatenation.

The web backend must not copy that pattern.

Use:

- parameterized SQL,
- stored procedures where appropriate,
- safe query builders/ORM parameter binding.

Never concatenate raw user input into SQL.

---

# 6. Secrets

Never commit:

- database passwords,
- client secrets,
- API keys,
- production connection strings,
- OAuth secrets.

Use secure secret stores/environment configuration.

Frontend bundles must contain no secrets.

---

# 7. Sensitive operations

Treat these as privileged:

- Close Deals
- user administration
- master-data mutations
- stock adjustments
- invoice send/mark-sent
- revenue-recognition edits
- potentially reopening/altering closed business records

The final backend should log and authorize them explicitly.

---

# 8. Audit logging

Future mutation audit records should capture at minimum:

- authenticated user,
- timestamp,
- operation,
- entity type,
- entity ID,
- correlation/request ID,
- outcome.

Where feasible capture before/after values for sensitive financial changes.

Legacy fields such as:

- `ID_User`
- `DT_User`

must be preserved if the database expects them.

---

# 9. Input/output security

Frontend:

- escape/render user text safely,
- avoid `dangerouslySetInnerHTML` unless audited,
- validate client-side for UX.

Backend later:

- validate again,
- enforce length/range/format constraints,
- reject unexpected fields,
- perform output encoding where relevant.

Client-side validation is not a security boundary.

---

# 10. Email security

Legacy behavior uses Outlook and a shared sender.

Future implementation must verify:

- who may trigger sends,
- sender identity,
- recipient validation,
- attachment access,
- sensitive data leakage,
- auditability,
- retry/idempotency behavior.

Do not send real emails from development fixtures.

---

# 11. File/attachment handling

Invoice PDF paths exist in the legacy workflow.

Future implementation must not expose arbitrary filesystem access.

Require:

- approved storage locations,
- safe path handling,
- no path traversal,
- authorization before file access,
- clear missing-file behavior.

---

# 12. Browser security baseline

Production deployment should include appropriate:

- HTTPS,
- secure cookies if cookies are used,
- SameSite policy,
- CSP,
- X-Content-Type-Options,
- frame protection,
- referrer policy,
- dependency vulnerability management.

Exact headers depend on deployment architecture.

---

# 13. Dependency security

CI should eventually include:

- dependency vulnerability scanning,
- lockfile integrity,
- automated dependency update process.

Do not accept critical vulnerabilities as normal development state.

---

# 14. Current-phase security tests

Can be tested now:

- Viewer edit controls are unavailable/disabled,
- Admin UI is unavailable to non-admin roles,
- untrusted text renders safely,
- no secrets exist in frontend source,
- mock API errors such as 401/403 render correctly.

Cannot be proven now:

- server authorization,
- database access control,
- token validation,
- production identity,
- SQL-injection resistance of backend queries,
- production email authorization.

---

# 15. Security completion rule

A feature involving sensitive data is not production-ready until:

1. UI permission behavior is tested.
2. Backend authorization exists.
3. Backend validation exists.
4. Audit behavior exists where required.
5. Integration/security tests pass.
