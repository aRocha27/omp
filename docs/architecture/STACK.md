# STACK.md

## Status

This file defines the current frontend and backend stack.

A different stack may be adopted only through an explicit architecture decision.

---

# 1. Frontend stack

| Concern | Default |
|---|---|
| Language | TypeScript |
| UI framework | React |
| Build tooling | Vite |
| Routing | React Router |
| Async/server-state handling | TanStack Query |
| Forms | React Hook Form |
| Schema/input validation | Zod |
| Data tables | TanStack Table |
| Unit/component testing | Vitest |
| Component testing | React Testing Library |
| Browser/E2E testing | Playwright |
| Mock network behavior | MSW where useful |
| Linting | ESLint |
| Formatting | Prettier |

CSS strategy can be selected during implementation, but it must support a reusable design system.

Acceptable approaches include:

- CSS modules,
- plain CSS with design tokens,
- Tailwind CSS.

Do not introduce multiple styling systems without a reason.

---

# 2. Backend stack

The repository includes a development/integration backend in `server/`.

| Concern | Current implementation |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript, strict |
| HTTP | Express |
| SQL Server client | `mssql` |
| Validation | Zod |
| Tests | Vitest + Supertest |

It connects to the existing database. Production deployment and database
parity remain integration work.

The backend connects to the existing database through configured profiles or
explicitly enabled development ad-hoc connections.

A previously considered alternative was:

```text
ASP.NET Core
```

It is not the current backend dependency; Node/TypeScript is the accepted
decision in ADR-0001.

The frontend remains coupled only to repository/API contracts, not to Express.

---

# 3. Future authentication direction

Likely production direction:

```text
Microsoft Entra ID
```

because the Access application currently derives identity from the Windows environment.

During frontend development:

- use a deterministic role/user simulator,
- keep authentication interfaces replaceable,
- do not fake production-grade security claims.

---

# 4. Future email direction

The legacy application uses Outlook COM automation.

The web platform should not depend on Outlook COM from the browser.

Future server-side options may include Microsoft Graph or another approved enterprise mail path.

Do not implement production email delivery during pure UI work.

---

# 5. TypeScript requirements

Use:

```text
"strict": true
```

unless there is a compelling documented reason not to.

Avoid:

- `any`,
- unchecked casts,
- implicit nullable assumptions,
- untyped API payloads.

Where legacy database types are unknown, represent uncertainty explicitly.

Example:

```ts
type Nullable<T> = T | null;
```

and document that actual DB nullability remains unverified.

---

# 6. Dependency policy

Before adding a dependency, ask:

1. Does the platform already solve this?
2. Is the dependency actively maintained?
3. Does it duplicate an existing dependency?
4. Does it create major bundle or security cost?
5. Will it make future integration harder?

Avoid dependency accumulation.

---

# 7. Browser support

Target modern evergreen browsers used by the organization.

At minimum develop/test against:

- Chromium
- Firefox
- WebKit through Playwright where practical

If the organization later mandates Edge-only behavior, retain standards-compliant implementation where possible.

---

# 8. File naming

Preferred:

```text
OrderListPage.tsx
OrderDetailPage.tsx
OrderFilters.tsx
orders.repository.ts
orders.mock-repository.ts
order.types.ts
recognition.rules.ts
```

Use names that describe domain responsibility.

Avoid generic files such as:

```text
utils.ts
helpers.ts
misc.ts
common.ts
```

unless their scope is genuinely clear.

---

# 9. Configuration

Use environment configuration for:

- API base URL,
- mock/real mode,
- authentication configuration,
- feature flags.

Never commit production secrets.

Example development modes:

```text
VITE_DATA_MODE=mock
VITE_DATA_MODE=api
```

The exact names may change.

---

# 10. Build quality

Production build must fail on:

- TypeScript compile errors,
- lint errors classified as blocking,
- failing tests required by CI.

Warnings that indicate real defects should not be normalized as permanent noise.
