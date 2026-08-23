# AGENT.md

## Project: Microsoft Access Orders Application → Web Platform

This repository is the working source for converting an existing Microsoft Access application into a browser-based business application.

The objective is to **replace the Microsoft Access frontend and workflow layer while continuing to use the existing database**.

The existing database is the system of record.

Do **not** design, create, migrate, duplicate, or replace the database unless the user explicitly changes that requirement.

---

# 1. Core project rules

Any agent working in this repository must follow these rules.

1. **Use the existing database.**
   - The future web application must connect to the existing database.
   - Do not create a new database merely because the frontend is being rewritten.
   - Do not introduce schema migrations unless explicitly requested.
   - Do not rename existing database objects without explicit approval.

2. **Treat the Access source as behavioral evidence.**
   - The `.cls` files contain VBA code-behind for Access forms.
   - They establish navigation, filtering, permissions, calculations, actions, and some dependencies.
   - They do not contain the complete visual definition of every Access form.

3. **Do not invent missing behavior.**
   - If a query definition, form definition, report definition, relationship, field type, or business rule is not present in the workspace, state that it is unknown.
   - Never silently fill gaps with a “typical” implementation.

4. **Preserve business behavior before modernizing it.**
   - First understand what Access does.
   - Then implement an equivalent workflow for the web.
   - UI modernization is encouraged.
   - Silent changes to business rules are not.

5. **Keep permissions enforced server-side.**
   - Hiding buttons is not sufficient authorization.
   - Read-only/editor/admin checks must also be enforced by the backend/API or database access layer.

6. **Use the HTML prototype only as a UI reference.**
   - `orders_platform_mvp.html` contains mock data.
   - It is not a data source.
   - It is not proof of business values, customer names, order amounts, stock quantities, or KPIs.

7. **Use `report.md` as derived documentation, not primary source.**
   - It is a convenient factual summary.
   - If it conflicts with raw Access source or the actual database, the raw source/database wins.

8. **Keep the application database-agnostic until the real connection details are known.**
   - Some object naming suggests a linked/upsized backend, but do not assume a specific engine solely from naming.
   - Once actual connection metadata is available, use it.

---

# 2. Workspace assumptions

The repository is expected to contain the decompressed source files directly.

Do not depend on an archive being present.

The important workspace artifacts include:

## Primary Access source

Expected form code-behind exports include:

- `Form_M_Geral.cls`
- `Form_Client.cls`
- `Form_Client_List.cls`
- `Form_Client_List_Sub.cls`
- `Form_Order_List.cls`
- `Form_Order_List_Sub.cls`
- `Form_Client_Fact_List.cls`
- `Form_E_Mail_Env.cls`
- `Form_E_Mail_Env_Sub.cls`
- `Form_Reconhecimento_Sub.cls`
- `Form_Reconhecido_porTipo_Crosstab.cls`
- `Form_Reconhecido_porTipo_Crosstab_DT.cls`
- `Form_Stck_List.cls`
- `Form_Stck_List_Sub.cls`
- `Form_Stck_Armazens_tbl.cls`
- `Form_Stck_Materiais_tbl.cls`
- `Form_M_Mapas.cls`
- `Form_tbl_Area.cls`
- `Form_tbl_Fact_Status.cls`
- `Form_tbl_Grp_Report.cls`
- `Form_tbl_Identificacao.cls`
- `Form_tbl_Instrumento.cls`
- `Form_tbl_Produto.cls`
- `Form_tbl_Tipo.cls`
- `Form_tbl_Tp_Cliente.cls`
- `Form_tbl_Tp_Doc_FT.cls`
- `Form_tbl_Tp_Order.cls`
- `Form_tbl_Tp_Reconhecimento.cls`
- `Form_tbl_Tp_Revenue.cls`
- `Form_tbl_Tp_Warranty.cls`
- `Form_tbl_Utilizador.cls`

There may also be additional Access exports added later.

When new raw Access files appear, treat them as part of the primary source set.

## Database / relationship reference

Expected relationship documentation includes the exported Access relationships PDF, normally named:

- `orders.pdf`

Rendered images may also exist, for example:

- `orders_render/page-1.png`
- `orders_render/page-2.png`
- `orders_render/page-3.png`
- `orders_render/page-4.png`

Rendered images are visual aids only.

Do not derive unambiguous FK constraints or cardinalities from an unclear connector line.

## Derived project documentation

- `report.md`

This contains a detailed factual analysis of the currently supplied forms and workflows.

## Architecture diagrams

- `orders_database_context.drawio`
- `c4_system_context_preview.png`
- `orders_database_context_preview.png`
- optional SVG previews
- any future `.drawio` architecture files

The `.drawio` file is editable design documentation.

It is not a substitute for real database metadata.

## UI prototype

- `orders_platform_mvp.html`

This is a single-file interactive MVP showing one possible web interface.

It includes mock presentation data and should remain visually useful even before real API integration.

---

# 3. Source-of-truth hierarchy

When two artifacts conflict, use this precedence.

## Tier 1 — Runtime / primary truth

1. Actual existing database metadata and actual database object definitions, when available.
2. Raw Access source files:
   - `.cls`
   - complete `SaveAsText` exports
   - saved-query SQL
   - macros
   - VBA modules
   - report definitions

## Tier 2 — Original structural evidence

3. Access relationship/database PDF and other original exports.

## Tier 3 — Derived documentation

4. `report.md`
5. `.drawio` diagrams
6. rendered diagram previews
7. `orders_platform_mvp.html`

Never allow a mock value from the HTML MVP to override primary source.

---

# 4. Known application architecture

The current Access application is a business application with these confirmed functional areas:

- Main application / navigation
- Authentication-like user lookup
- Permission resolution
- Clients
- Orders
- Factory / fulfillment
- Client invoicing
- Invoice email dispatch
- Revenue recognition
- Stock
- Reports and Excel exports
- Administrative/master-data maintenance
- Close Deals routine

The main Access form is:

- `M_Geral`

It functions as the central application menu and permission state holder.

---

# 5. Confirmed user and permission model

The Access application obtains the current Windows username using:

- `WScript.Network.Username`

It then looks up the user in:

- `Utilizador`

Confirmed fields used by the VBA include:

- `ID_User`
- `User_Name`
- `Cancelado`
- `Read_Only`
- `Admin`

The application maintains two main form-level permission flags:

- `Editar`
- `Admin`

## Effective behavior

### Editor

When the user is not read-only:

```text
Editar = "S"
```

### Read-only

When:

```text
Read_Only = True
```

the main form sets:

```text
Editar = "N"
```

### Administrator

When:

```text
Admin = True
```

the main form sets:

```text
Editar = "S"
Admin  = "S"
```

and shows admin-only controls.

### Non-accepted / unregistered user branch

The application leaves the user without edit permissions:

```text
Editar = "N"
```

The supplied code does not automatically quit in this branch.

## Web replacement requirement

The implementation may replace Windows/VBA identity acquisition with a web-compatible identity provider, but it must preserve the effective application permission semantics unless explicitly redesigned.

The web system should model at least:

- read-only/viewer,
- editor,
- administrator.

Authorization must be enforced on the server side.

---

# 6. Confirmed main navigation from `M_Geral`

The main Access form opens these areas:

| Main action | Access form |
|---|---|
| Clients | `Client_List` |
| Orders | `Order_List` |
| Stock | `Stck_List` |
| Reports | `M_Mapas` |
| Client invoicing | `Client_Fact_List` |
| Recognition by type | `Reconhecido_porTipo_Crosstab_DT` |
| Factory | `Enc_Factory_List` |
| Exit | quits Access |

Role-aware navigation exists for several areas.

For example:

- Clients open edit or read-only according to `Editar`.
- Orders open edit or read-only according to `Editar`.
- Client invoicing opens edit or read-only according to `Editar`.
- Factory opens edit or read-only according to `Editar`.

Not every handler applies permissions consistently. Preserve the observed behavior in documentation, but do not assume inconsistent UI checks are intentional security requirements.

---

# 7. Admin maintenance areas

The `M_Geral` maintenance selector opens the following forms.

| Selector | Form |
|---:|---|
| 1 | `tbl_Area` |
| 2 | `tbl_Tipo` |
| 3 | `tbl_Produto` |
| 4 | `tbl_Instrumento` |
| 5 | `tbl_Tp_Cliente` |
| 6 | `tbl_Tp_Order` |
| 7 | `tbl_Tp_Revenue` |
| 8 | `tbl_Tp_Warranty` |
| 9 | `tbl_Tp_Reconhecimento` |
| 10 | `tbl_Tp_Doc_FT` |
| 11 | `tbl_Grp_Report` |
| 12 | `tbl_Fact_Status` |
| 98 | `tbl_Utilizador` |
| 99 | `tbl_Identificacao` |

The selector is hidden from non-admin users by the current main form.

A web implementation should normally expose these as an Administration section rather than recreating the numeric selector UI.

---

# 8. Client workflow

Relevant source files:

- `Form_Client.cls`
- `Form_Client_List.cls`
- `Form_Client_List_Sub.cls`

## Confirmed search dimensions

The client list supports:

- Client ID
- PHC number
- Client name
- Contact
- Client type
- Defense flag

Confirmed field behavior includes:

- `ID_Cliente`: exact numeric equality
- `no_PHC`: exact comparison
- `Nome`: contains search
- `contacto`: contains search
- `ID_Tp_Cliente`: exact comparison
- `Defense`: boolean comparison

## Confirmed navigation

A client list row opens:

- `Client`

filtered by:

- `ID_Cliente`

It opens in edit or read-only mode depending on `Editar`.

## Create behavior

The list can open `Client` in add mode.

The insert button is enabled only for an editable user in the supplied code.

---

# 9. Order workflow

Relevant source files:

- `Form_Order_List.cls`
- `Form_Order_List_Sub.cls`
- the `Order` form itself is a required runtime dependency, but its class is not present in the known source set

## Confirmed list source

The Access list builds from:

```sql
select * from V_Order_List
```

## Confirmed filters

- order date from
- order date to
- client name
- factory-order boolean
- order type
- area
- type
- product
- instrument
- PHC order
- closed-deal boolean

## Confirmed result ordering

```text
DT_Order DESC
ID_Order DESC
```

## Confirmed row navigation

Rows open:

- `Order`

filtered by:

- current `ID_Order`

Mode depends on `Editar`.

## Create behavior

The order list can open `Order` in add mode.

The insert button is enabled only for an editable user in the supplied code.

## Email workflow entry

The order list can open:

- `E_Mail_Env`

---

# 10. Known Order fields

The relationship export visibly lists these fields on `Order`:

- `ID_Order`
- `DT_Order`
- `Order_Factory`
- `ID_Tp_Order`
- `Encomenda_Cli_PHC`
- `ID_Client`
- `ID_Area`
- `ID_Tipo`
- `ID_Produto`
- `ID_Instrumento`
- `Orc_Proposta`
- `PO_Cliente`
- `Sell_Price`
- `ID_Tp_Warranty`
- `Warranty_Reserve`
- `Warranty_DT_Inicio`
- `ID_Tp_Revenue`
- `Facturado`
- `Reconhecido`
- `Cod_Enc_Fornecedor`
- `Obs`
- `Negocio_Fechado`
- `ID_User`
- `DT_User`
- `upsize_ts`
- `Kit`
- `Kit_Amount`
- `Contacto`
- `Email`

Do not infer exact SQL types, nullability, indexes, or constraints from this list alone.

---

# 11. Factory / fulfillment workflow

The main menu opens:

- `Enc_Factory_List`

No corresponding class module is known to be present in the current source set.

The relationship export includes `Factory_BK`.

Known fields include:

- `ID_Factory_BK`
- `ID_Order`
- `Cod_Enc_Factory`
- `Order_Confirmation`
- `Invoice`
- `Ship_DT`
- `Ano`
- `Num`
- `ID_User`
- `DT_User`
- `upsize_ts`
- `Tracking_Number`
- `Weight`
- `Comments`
- `Provider_Invoice`
- `ID_Fact_Status`

Treat `Factory_BK.ID_Order` as an application association to orders.

Do not claim an enforced FK or cardinality unless actual database metadata confirms it.

---

# 12. Invoicing workflow

Relevant files:

- `Form_Client_Fact_List.cls`
- `Form_E_Mail_Env.cls`
- `Form_E_Mail_Env_Sub.cls`

Known invoice table:

- `Facturacao`

Known visible fields:

- `ID_Facturacao`
- `ID_Order`
- `DT_Doc_FT`
- `ID_Tp_Doc_FT`
- `N_Doc_FT`
- `Valor_Doc_FT`
- `ID_User`
- `DT_User`
- `upsize_ts`
- `Imprimiu`
- `Imp_Block`
- `Nome_PDF`
- `E_Invoice`

The list/search logic references:

- `V_Facturacao_List`

The invoice-email workflow references:

- `E_Mail_Env_List`

These saved query/view definitions are required before faithfully reimplementing their joins/calculated fields.

---

# 13. Invoice email behavior

`Form_E_Mail_Env.cls` uses:

- DAO
- Outlook COM automation

Confirmed behavior:

1. Build a filtered recordset from `E_Mail_Env_List`.
2. Iterate eligible rows.
3. Create Outlook emails.
4. Send on behalf of:

```text
brukerportugal@bruker.com
```

5. Use the row email address as recipient.
6. Generate subject/body text from invoice/order/client information.
7. Check for a PDF attachment.
8. Attach the PDF if it exists.
9. Log missing attachments.
10. Handle selected send errors.
11. Send a process log.
12. A separate action can update eligible `Facturacao` records to:

```text
Imprimiu = True
```

Eligibility checks include:

```text
Imprimiu = False
Imp_Block = False OR Imp_Block IS NULL
```

## Important source observations

The supplied VBA contains several implementation details that should be reviewed rather than blindly copied:

- `MsgBox "tst"` remains in the active send routine.
- Some body/attachment values are assigned from form controls before looping through the recordset.
- The email counter is initialized but not incremented in the normal loop.

Do not “fix” these silently. Record them as legacy behavior/issues and implement the desired behavior deliberately.

---

# 14. Revenue recognition workflow

Relevant file:

- `Form_Reconhecimento_Sub.cls`

Known table:

- `Reconhecimento`

Known visible fields:

- `ID_Reconhecimento`
- `ID_Order`
- `ID_Tp_Reconhecimento`
- `DT_Reconhecimento`
- `Valor_Reconhecimento`
- `ID_User`
- `DT_User`
- `upsize_ts`

## Recognition categories

The supplied VBA distinguishes:

```text
ID_Tp_Reconhecimento = "W"
```

from:

```text
ID_Tp_Reconhecimento <> "W"
```

`W` is treated as the warranty side of recognition.

Non-`W` values are treated as the instrument/non-warranty side.

## Confirmed formulas

### Non-warranty recognized total

```text
S_I_Reconh =
SUM(Valor_Reconhecimento)
WHERE ID_Order = current order
AND ID_Tp_Reconhecimento <> "W"
```

### Warranty recognized total

```text
S_W_Reconh =
SUM(Valor_Reconhecimento)
WHERE ID_Order = current order
AND ID_Tp_Reconhecimento = "W"
```

### Non-warranty maximum

```text
Sell_Price - Warranty_Reserve
```

### Warranty maximum

```text
Warranty_Reserve
```

### Current non-warranty backlog in the active update handlers

```text
(Sell_Price - Warranty_Reserve)
- SUM(non-W recognition dated <= today)
```

### Current warranty backlog in the active update handlers

```text
Warranty_Reserve
- SUM(W recognition dated <= today)
```

## Validation

If a newly entered recognition value causes the applicable total to exceed its allowed amount:

- the user receives a critical warning,
- `Valor_Reconhecimento` is reset to `Null`,
- totals are recalculated.

## Historical records

For:

```text
DT_Reconhecimento < Date
```

the date/type/value controls are locked when focused.

Double-clicking a historical field shows a warning and explicitly unlocks that control.

## Known inconsistency

After record deletion, backlog controls are recalculated differently from the active update handlers.

Do not choose one behavior silently.

Treat this as a legacy ambiguity requiring confirmation or regression testing against the running Access application.

---

# 15. Recognition-by-type workflow

Relevant files:

- `Form_Reconhecido_porTipo_Crosstab.cls`
- `Form_Reconhecido_porTipo_Crosstab_DT.cls`

The date form initializes:

```text
Data_Inicial = January 1 of current year
Data_Final   = December 31 of current year
```

It opens:

- `Reconhecido_porTipo_Crosstab`

The crosstab form includes lookup/navigation behavior using:

- `DCount`
- `DoCmd.FindRecord`

The underlying crosstab SQL is not in the known source.

Do not recreate it from assumptions.

---

# 16. Stock workflow

Relevant files:

- `Form_Stck_List.cls`
- `Form_Stck_List_Sub.cls`
- `Form_Stck_Armazens_tbl.cls`
- `Form_Stck_Materiais_tbl.cls`

The list queries:

```sql
select * from dbo_V_stck_Group
```

Confirmed filters:

- `ref` contains
- `description` contains
- `id_arm` exact match

Known actions include:

- consult stock movements,
- add stock movement,
- maintain warehouses,
- maintain materials.

Referenced forms whose class code is not in the known set:

- `Stck_Mov_Mat_tbl_add`
- `Stck_Mov_Mat_tbl_edt`

Admin/read-only behavior is inconsistent across the legacy button handlers.

Backend authorization in the web version must be deliberate and explicit.

---

# 17. Reporting workflow

Relevant file:

- `Form_M_Mapas.cls`

The current Access reporting hub supports:

- report preview,
- Excel export.

Confirmed report families:

1. Production by Area and Type
2. Production by Area, Type and Product
3. NOB
4. NOB by Geographic Region
5. Revenue
6. Revenue by Geographic Region
7. Backlog

Known report names include:

- `Producao_AT`
- `Producao_ATP`
- `R_NOB`
- `R_NOB_Geog`
- `R_Revenue`
- `R_Revenue_Geog`
- `R_Backlog`

## Confirmed filters/concepts

- start date
- end date
- area
- type
- product
- client type
- revenue type

At least one date is required before generating a report.

Backlog additionally requires the end date.

Product options are requeried when area changes.

## Dynamic export behavior

The Access implementation uses a temporary QueryDef:

- `qry_EXP`

for several Excel exports.

The web replacement does not need to emulate `QueryDef` mechanics, but output equivalence should be preserved where required.

---

# 18. Reporting data dependencies

Known staging/query objects include:

## Production

- `Producao_rpt`
- `rpt_Producao_BL_i`
- `rpt_Producao_BL_i_warranty`
- `rpt_Producao_BL_f`
- `rpt_Producao_BL_f_warranty`
- `rpt_Producao_NOB`
- `rpt_Producao_NOB_Warranty`
- `rpt_Producao_Revenue`
- `rpt_Producao_Revenue_warranty`
- `rpt_Producao_AT`
- `rpt_Producao_ATP`

## NOB / Revenue / Backlog

- `rpt_R_NOB`
- `rpt_R_NOB_sem_warranty`
- `rpt_R_NOB_warranty`
- `rpt_R_Revenue`
- `rpt_R_Backlog`
- `rpt_R_Backlog_Ship`

Do not reimplement these formulas without their actual SQL definitions or equivalent runtime verification.

---

# 19. Close Deals routine

The admin-visible action in `M_Geral` executes:

1. `FNeg_Order_Reconhecimento_TBL`
2. `FNeg_Order_Reconhecimento_UPD`
3. deletes `FNeg_aux`

The routine temporarily disables Access warnings.

The saved-query SQL is not known from the currently documented source.

Therefore:

- do not implement guessed “close deal” logic,
- obtain the actual query definitions first,
- then implement an equivalent transaction or call the existing database behavior if it remains available.

---

# 20. Known data objects

The relationship export visibly includes at least:

- `Area`
- `Produto`
- `Instrumento`
- `Tp_Revenue`
- `Order`
- `Tp_Order`
- `Client`
- `Facturacao`
- `Reconhecimento`
- `Tipo`
- `Grp_Report`
- `Tp_Warranty`
- `Factory_BK`
- `Tp_Doc_FT`
- `Tp_Reconhecimento`
- `Tp_Cliente`

The VBA additionally references:

- `Utilizador`
- `Fact_Status`
- `Identificacao`
- stock-related tables/views

---

# 21. Known identifier-based associations

The source strongly establishes that the application uses these identifiers to relate data:

```text
Order.ID_Client              → Client
Order.ID_Area                → Area
Order.ID_Tipo                → Tipo
Order.ID_Produto             → Produto
Order.ID_Instrumento         → Instrumento
Order.ID_Tp_Order            → Tp_Order
Order.ID_Tp_Warranty         → Tp_Warranty
Order.ID_Tp_Revenue          → Tp_Revenue

Facturacao.ID_Order          → Order
Reconhecimento.ID_Order      → Order
Factory_BK.ID_Order          → Order

Produto.ID_Area              → Area
Instrumento.ID_Produto       → Produto
Tipo.ID_Grp_Report           → Grp_Report
```

These are confirmed application associations from identifier usage and source structure.

Unless actual database metadata is available, do **not** state:

- FK enforcement,
- cascade behavior,
- one-to-one vs one-to-many cardinality,
- uniqueness,
- nullable/required status.

---

# 22. Known lookup/master data concepts

The application uses the following as maintained business reference data:

- Area
- Type
- Product
- Instrument
- Client Type
- Order Type
- Revenue Type
- Warranty Type
- Recognition Type
- Invoice / Document Type
- Report Group
- Facturation Status
- Users
- Identification

Prefer stable identifiers from the existing database in API payloads.

Use descriptive values for UI display.

---

# 23. Legacy source inconsistencies to preserve as explicit decisions

Do not silently normalize these when implementing the web system.

## Client invoicing list

Search source:

```text
V_Facturacao_List
```

Clear/reset source:

```text
V_Enc_Factory_List
```

The intent is not proven.

## Recognition backlog after delete

Delete recalculation differs from normal update recalculation.

The desired final rule must be verified.

## Invoice email loop

Recipient is read per recordset row, but other message values are assigned before the loop.

The intended batch behavior must be confirmed.

## Invoice email count

The normal send loop does not visibly increment the counter.

## Backlog Excel export

Filtered and unfiltered projections are not identical.

## Stock role behavior

Some stock actions have explicit permission checks and others do not.

## Recognition crosstab permission

Read-only logic is commented out in the supplied main-form handler.

## `Stck_List_Sub`

Its exported code contains order-style row handlers matching `Order_List_Sub`.

Do not assume every handler is active UI behavior without the complete form design.

## Stock `Command46`

It attempts to open:

- `Clientes`

while the supplied client form used elsewhere is:

- `Client`

Treat this as unresolved legacy code.

---

# 24. Missing source that should be requested when needed

A future agent should identify missing primary source instead of guessing.

Highest-value missing items include:

## Complete Access form definitions

Especially:

- `Order`
- `Enc_Factory_List`
- `Stck_Mov_Mat_tbl_add`
- `Stck_Mov_Mat_tbl_edt`

Prefer full `Application.SaveAsText` form exports where possible.

## Saved query SQL

Especially:

- `V_Order_List`
- `Client_List`
- `V_Facturacao_List`
- `V_Enc_Factory_List`
- `E_Mail_Env_List`
- `dbo_V_stck_Group`
- `Reconhecido_porTipo_Crosstab`
- `FNeg_Order_Reconhecimento_TBL`
- `FNeg_Order_Reconhecimento_UPD`
- all `rpt_*` objects

## Database metadata

When available, obtain:

- database engine,
- connection method,
- actual table/view definitions,
- keys,
- indexes,
- relationships,
- constraints,
- data types,
- nullability,
- stored procedures/functions if applicable.

## Report definitions

Required if output parity matters.

---

# 25. Web application implementation principles

These are project constraints, not a mandated framework.

## Frontend

The web UI should:

- replace Access popup/navigation behavior with clear browser navigation,
- support searchable/filterable data grids,
- support direct record detail pages,
- indicate read-only state clearly,
- expose admin areas only to admins,
- preserve the original business terminology where practical,
- avoid reproducing Access visual limitations unnecessarily.

The existing `orders_platform_mvp.html` is a useful starting point for information architecture.

## Backend

The backend should:

- be the only normal path from browser UI to the database,
- authenticate the user,
- authorize every mutation,
- validate business rules,
- execute transactions,
- wrap database/query behavior behind explicit services or endpoints,
- avoid embedding database credentials in frontend code.

## Data access

Because the database is staying:

- query the existing objects,
- map database records into explicit application DTOs/models,
- avoid rewriting the schema by default,
- preserve existing identifiers,
- use parameterized queries,
- avoid concatenating raw user input into SQL.

The original Access code often builds SQL strings dynamically. Do **not** reproduce unsafe string-concatenation patterns in the new application.

---

# 26. Suggested application modules

A reasonable web information architecture based on confirmed workflows is:

```text
Orders Platform
│
├── Dashboard
│
├── Orders
│   ├── Search / List
│   ├── Order Detail
│   ├── Factory
│   ├── Invoices
│   └── Revenue Recognition
│
├── Clients
│   ├── Search / List
│   └── Client Detail
│
├── Factory / Invoicing
│
├── Revenue Recognition
│
├── Stock
│   ├── Stock View
│   ├── Movements
│   ├── Warehouses
│   └── Materials
│
├── Reports
│   ├── Production
│   ├── NOB
│   ├── Revenue
│   └── Backlog
│
└── Administration
    ├── Users
    ├── Areas
    ├── Types
    ├── Products
    ├── Instruments
    ├── Client Types
    ├── Order Types
    ├── Revenue Types
    ├── Warranty Types
    ├── Recognition Types
    ├── Document Types
    ├── Report Groups
    └── Facturation Status
```

This is a target UI structure, not evidence of separate database schemas.

---

# 27. API design guidance

Do not create endpoints mechanically for every VBA event.

Translate workflows into domain operations.

Examples:

```text
GET    /api/orders
GET    /api/orders/{id}
POST   /api/orders
PATCH  /api/orders/{id}

GET    /api/clients
GET    /api/clients/{id}
POST   /api/clients
PATCH  /api/clients/{id}

GET    /api/orders/{id}/recognition
POST   /api/orders/{id}/recognition
PATCH  /api/recognition/{id}
DELETE /api/recognition/{id}

GET    /api/invoices/email-queue
POST   /api/invoices/send
POST   /api/invoices/mark-sent

GET    /api/stock
GET    /api/stock/movements
POST   /api/stock/movements

GET    /api/reports/production
GET    /api/reports/nob
GET    /api/reports/revenue
GET    /api/reports/backlog
```

These endpoint names are design guidance only.

If the implementation framework uses another pattern, preserve the domain operations rather than these exact URLs.

---

# 28. Testing expectations

Every migrated workflow should have regression coverage against known Access behavior.

At minimum:

## Authorization

- read-only user cannot mutate data,
- editor can perform allowed standard mutations,
- admin can access admin functions,
- protected backend routes reject unauthorized calls.

## Orders

- confirmed filters work,
- ordering is `DT_Order DESC`, then `ID_Order DESC`,
- order detail loads by `ID_Order`,
- create/edit/read-only behavior matches the approved role rules.

## Clients

- confirmed filters work,
- create/edit/read-only behavior works,
- client detail loads by `ID_Cliente`.

## Recognition

- `W` and non-`W` totals are separated,
- non-`W` limit uses `Sell_Price - Warranty_Reserve`,
- `W` limit uses `Warranty_Reserve`,
- over-limit values are rejected,
- historical-edit behavior is tested,
- backlog formula is verified against the approved rule.

## Invoicing/email

- queue filters work,
- PDF existence behavior is tested,
- send failures are surfaced,
- marking sent obeys `Imprimiu` / `Imp_Block` conditions.

## Stock

- reference filter,
- description filter,
- warehouse filter,
- role checks for mutations.

## Reports

- required date checks,
- Backlog end-date requirement,
- all confirmed report families,
- Excel export if retained.

## Close Deals

Do not write acceptance tests until the real query logic is known.

Once known, test the operation transactionally against representative data.

---

# 29. UI prototype rules

`orders_platform_mvp.html` is intentionally self-contained.

When evolving it:

- keep it easy to open locally,
- do not add production credentials,
- do not imply mock data is real,
- keep clear separation between visual prototype and real API integration,
- preserve major confirmed modules unless the product direction changes.

If a production framework is introduced later, the MVP may remain as a design reference rather than being forced into the production codebase.

---

# 30. Diagram rules

For `.drawio` files:

- keep diagrams editable,
- prefer clear entity/system names,
- distinguish confirmed from inferred relationships when necessary,
- do not invent FK cardinality,
- update diagrams when new primary database metadata proves additional relations.

The current diagrams should be treated as architecture documentation, not executable configuration.

---

# 31. Documentation rules

When modifying `report.md` or creating new technical documentation:

- label confirmed facts as confirmed,
- distinguish inference from source evidence,
- include filenames/object names,
- preserve original database and Access terminology,
- document legacy inconsistencies rather than silently fixing them,
- update documentation when newly supplied raw source resolves an unknown.

Avoid vague statements such as “probably,” “normally,” or “should be” in factual sections unless explicitly marked as design guidance.

---

# 32. Do not do these things

Do **not**:

- create a new database without being asked,
- propose database migration as the default solution,
- invent query SQL,
- invent report formulas,
- invent FK cardinality,
- assume database types from field names,
- assume `upsize_ts` proves the backend engine,
- use mock HTML values as production facts,
- port VBA line-for-line without understanding the workflow,
- put database credentials in browser JavaScript,
- enforce permissions only by hiding UI,
- concatenate untrusted input into SQL,
- change recognition formulas without explicit verification,
- silently correct observed legacy inconsistencies,
- discard Portuguese/business field names before mapping their meaning,
- remove existing database compatibility just to simplify a new framework.

---

# 33. Recommended agent workflow for any feature

For any requested migration or feature work:

1. **Identify the relevant Access source files.**
2. **Read the raw VBA before coding.**
3. **Check `report.md` for the current factual summary.**
4. **Identify every database/query/form dependency used by that workflow.**
5. **Separate confirmed behavior from missing behavior.**
6. **If required source is missing, implement only what is supported and document the gap.**
7. **Design the web interaction at workflow level, not VBA-event level.**
8. **Implement backend authorization and validation first-class.**
9. **Use the existing database through parameterized data access.**
10. **Add regression tests for confirmed rules.**
11. **Update documentation/diagrams if the architecture materially changes.**
12. **Never claim parity for behavior that has not been verified.**

---

# 34. Current MVP direction

The current HTML MVP demonstrates this intended user experience:

- persistent sidebar,
- dashboard landing page,
- role preview,
- searchable order grid,
- searchable client grid,
- integrated order detail view,
- factory/invoicing area,
- recognition summary,
- stock view,
- report launcher,
- admin/master-data area.

This direction is acceptable as a starting UI concept.

The goal is **functional equivalence plus a better browser UX**, not a pixel-for-pixel clone of Access.

---

# 35. Definition of success

The migration is successful when users can perform the approved business workflows from the web application without depending on the Access frontend, while the existing database remains the system of record.

Success requires:

- correct data access,
- correct permissions,
- preserved business rules,
- equivalent operational reports/exports where required,
- safe invoice-email processing,
- accurate revenue-recognition calculations,
- usable stock workflows,
- support for administrative master data,
- verified Close Deals behavior,
- clear auditability of any deliberate differences from the legacy Access application.

---

# 36. Final rule

**When uncertain, prefer evidence over assumption.**

Read the existing source, inspect the existing database when available, preserve confirmed behavior, and explicitly document unknowns.

Do not let the convenience of a new web stack overwrite business behavior that has not yet been understood.
