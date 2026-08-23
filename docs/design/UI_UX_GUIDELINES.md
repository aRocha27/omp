# UI_UX_GUIDELINES.md

## Product direction

The new application should preserve Access workflows but should not visually imitate Microsoft Access.

The target is a modern operational dashboard optimized for business users.

---

# 1. Core UX principles

1. Orders are the central workflow.
2. Search/filter screens must be fast to scan.
3. Read-only state must be obvious.
4. Financial values must be easy to compare.
5. Dangerous actions must require explicit confirmation.
6. Do not hide critical state only in color.
7. Empty/loading/error states are first-class designs.
8. Reduce unnecessary popup-window behavior from Access.
9. Use consistent controls and terminology.
10. Preserve original business labels where they help user recognition.

---

# 2. Layout

Use a persistent desktop navigation pattern.

Recommended main areas:

- Dashboard
- Orders
- Clients
- Factory / Invoicing
- Recognition
- Stock
- Reports
- Administration

Use breadcrumbs or clear page titles for detail pages.

---

# 3. Tables

Tables should support:

- sticky/clear headers where useful,
- sorting where meaningful,
- filters outside or above the table,
- consistent money/date alignment,
- row click to open detail,
- keyboard accessibility,
- empty state,
- loading skeleton,
- error state.

Do not overload tables with every database field.

---

# 4. Forms

Use logical sections.

For Order detail, likely sections/tabs include:

- Overview
- Factory
- Invoices
- Recognition
- History

This is a UI design choice informed by the workflow, not a claim about the legacy form layout.

---

# 5. Read-only mode

Viewer mode should:

- clearly indicate read-only state,
- hide or disable mutations consistently,
- still allow navigation/search/report viewing as approved.

Avoid confusing disabled controls everywhere if a clean read-only presentation is better.

---

# 6. Admin mode

Admin-only actions must:

- be visually separated,
- use confirmations for destructive/sensitive operations,
- display clear consequences.

`Close Deals` should never look like an ordinary navigation button.

---

# 7. Financial data

Money values should:

- use consistent currency formatting,
- align numerically,
- distinguish totals from balances,
- show recognition/backlog side by side.

Avoid relying on color alone for positive/negative status.

---

# 8. Recognition UI

Show:

- capacity,
- recognized amount,
- remaining/backlog,
- type (`W` vs non-`W`),
- date,
- historical state.

Over-limit attempts should produce explicit validation text.

---

# 9. Feedback patterns

Use:

- inline validation for form errors,
- toast or status feedback for successful saves,
- confirmation dialog for sensitive actions,
- retry actions for recoverable load errors.

Avoid unnecessary modal dialogs for routine navigation.

---

# 10. Accessibility

All controls need:

- accessible labels,
- visible focus,
- keyboard operation,
- correct semantics.

Dialogs must trap/restore focus correctly.

Tables require proper headers.

---

# 11. Responsive behavior

Primary target is desktop/laptop business use.

Tablet should remain usable.

Mobile should not break, though not every complex operational table needs a mobile-first experience.

Use horizontal table scrolling when appropriate rather than compressing data into unreadable layouts.

---

# 12. Design-system components

Create reusable components for:

- Button
- Input
- Select
- Date field
- Checkbox
- Modal/Dialog
- Drawer
- Table/DataGrid
- Badge
- Alert
- Toast
- Tabs
- Card
- Loading skeleton
- Empty state
- Error state
- Page header
- Filter bar
- Confirmation dialog
- Money display
- Read-only indicator

Do not build each page with custom one-off primitives.
