# Billing Rates Design

## Goal

Add a consistent billing-rate system that defines what ParadePaard charges clients per hour for planned work. The system must support client default rates, project-specific rates copied at project creation, employee-specific billing overrides, and finance calculations that can explain revenue and margin per assignment, shift, project, and client.

Employee pay is out of scope for this billing-rate system. Employee pay remains contract-based and is handled through contracts, timesheets, payroll rules, and payroll finance calculations.

## User-Facing Concepts

Use the term "Billing rates" everywhere.

- Client billing rates page: `/management/clients/:clientCompanyId/billing-rates`
- Employee billing rates page: `/management/users/:userId/billing-rates`
- Client detail tab label: `Billing rates`
- Employee detail tab label: `Billing rates`

The client page is the source management view. The employee page is a filtered view of employee-specific billing-rate overrides.

## Rate Layers

Billing rates resolve through these layers:

1. Project employee function billing rate
2. Project function billing rate
3. Client employee function billing rate
4. Client function billing rate
5. Missing-rate warning

In code-like form:

```ts
projectEmployeeFunctionBillingRate
    ?? projectFunctionBillingRate
    ?? clientEmployeeFunctionBillingRate
    ?? clientFunctionBillingRate
    ?? missingBillingRateWarning
```

Because project function rates are copied from the client defaults when a project is created, normal shift revenue should usually resolve from:

```ts
projectEmployeeFunctionBillingRate ?? projectFunctionBillingRate
```

The client-level rates mainly feed future project creation and act as fallback if a project has incomplete copied rates.

## Client Billing Rates Page

The client billing-rates page lives under the existing client detail shell.

It should contain three sections inside one tab:

1. Default billing rates
2. Project billing rates
3. Employee overrides

### Default Billing Rates

Default rates define what future projects should copy for this client.

Example columns:

- Function
- Rate per hour
- Active from
- Active to
- Status
- Notes
- Actions

Editing a default rate creates a new active version from the chosen effective timestamp. Existing projects do not automatically change. New projects created after the edit copy the new default rate.

### Project Billing Rates

Project rates define the actual function rates for one project.

When a project is created for a client, the active client default billing rates at that creation moment are copied into project billing-rate rows. Project rates are then owned by the project and can be edited without changing the client defaults.

Example columns:

- Project
- Function
- Project rate per hour
- Copied from client default
- Last updated
- Notes
- Actions

Editing a project rate affects only that project.

### Employee Overrides

Employee overrides define special billing rates for a specific employee, client, and function. They may optionally be scoped to a specific project.

Example columns:

- Employee
- Project scope
- Function
- Override rate per hour
- Compared default/project rate
- Active from
- Active to
- Notes
- Actions

A client-level employee override applies to the employee for that client and function unless a project-level employee override exists.

A project-level employee override applies only to that employee, project, and function.

## Employee Billing Rates Page

The employee billing-rates page lives under the existing user detail area:

`/management/users/:userId/billing-rates`

It shows the same billing-rate override concept from the employee perspective. It should not manage the employee's wage or payroll rate.

Example sections:

- Client-level overrides for this employee
- Project-level overrides for this employee

Example columns:

- Client
- Project
- Function
- Override rate per hour
- Default/project rate
- Active from
- Active to
- Notes

Editing from this page is acceptable if the user has the required billing-rate management permission. Any edit must update the same underlying override records shown on the client page.

## Project Creation Behavior

When creating a project with a client:

1. The system finds active client function billing rates for that client at the project creation time.
2. It copies those rates into project function billing-rate rows.
3. The project uses its copied rates for shift revenue.
4. Later edits to client defaults do not change the project.

This means "future projects" are based on when the project is created, not on the shift date.

If a project is created before any client default rates exist, the project should be created but marked with missing billing-rate warnings. Planning and finance should surface those warnings.

## Planning Behavior

Project creation still requires selecting a client.

Shift creation should use the project's billing-rate set:

- The planner selects a function for the shift.
- The UI shows the resolved project function billing rate if available.
- If no project function rate exists, the UI shows a missing-rate warning.

Once employees are assigned, assignment-level finance can resolve employee-specific overrides.

Planning should not ask the admin to manually enter a billing rate for every shift by default. Project rates and employee overrides should drive the result.

## Finance Behavior

Finance calculates revenue and cost per assigned employee per shift.

Revenue:

```ts
clientRevenue = workedHours * resolvedBillingRate
```

Cost:

```ts
employeeCost =
    contractHourlyWage
    + holidayAllowance
    + vacationBuildUp
    + employerPremiums
    + pension
    + otherEmployerCosts
```

Margin:

```ts
profit = clientRevenue - employeeCost
```

Finance views should roll up records by:

- Assignment
- Shift
- Project
- Client
- Period

Finance records should store the resolved billing rate source, for example:

- `PROJECT_EMPLOYEE_FUNCTION`
- `PROJECT_FUNCTION`
- `CLIENT_EMPLOYEE_FUNCTION`
- `CLIENT_FUNCTION`
- `MISSING`

Once payroll or invoicing is approved, the finance values should be snapshotted or locked so later rate corrections do not silently change approved historical numbers.

## Data Model

Recommended backend entities:

### ClientFunctionBillingRate

Default rate for a client and function.

Fields:

- `id`
- `companyId`
- `clientCompanyId`
- `functionName`
- `ratePerHour`
- `effectiveFrom`
- `effectiveTo`
- `active`
- `notes`
- `createdAt`
- `updatedAt`
- `createdByUserId`
- `updatedByUserId`

### ProjectFunctionBillingRate

Copied/project-owned function rate.

Fields:

- `id`
- `companyId`
- `clientCompanyId`
- `projectId`
- `functionName`
- `ratePerHour`
- `sourceClientFunctionBillingRateId`
- `copiedAt`
- `notes`
- `createdAt`
- `updatedAt`
- `createdByUserId`
- `updatedByUserId`

### EmployeeClientFunctionBillingRate

Employee override at client level.

Fields:

- `id`
- `companyId`
- `clientCompanyId`
- `userId`
- `functionName`
- `ratePerHour`
- `effectiveFrom`
- `effectiveTo`
- `active`
- `notes`
- `createdAt`
- `updatedAt`
- `createdByUserId`
- `updatedByUserId`

### EmployeeProjectFunctionBillingRate

Employee override at project level.

Fields:

- `id`
- `companyId`
- `clientCompanyId`
- `projectId`
- `userId`
- `functionName`
- `ratePerHour`
- `effectiveFrom`
- `effectiveTo`
- `active`
- `notes`
- `createdAt`
- `updatedAt`
- `createdByUserId`
- `updatedByUserId`

## Permissions

Billing rates are internal financial data and should not be visible to regular employees.

Recommended permissions:

- `CAN_VIEW_BILLING_RATES`
- `CAN_MANAGE_BILLING_RATES`

Access rules:

- Client billing-rates tab requires `CAN_VIEW_BILLING_RATES` or `CAN_MANAGE_BILLING_RATES`.
- Employee billing-rates tab requires `CAN_VIEW_BILLING_RATES` or `CAN_MANAGE_BILLING_RATES`.
- Creating, editing, ending, or deleting billing-rate records requires `CAN_MANAGE_BILLING_RATES`.
- Finance pages can read billing-rate snapshots through existing payroll finance permissions, but direct rate management still requires billing-rate permissions.

If adding new permissions is too large for the first implementation step, the temporary fallback may be `CAN_MANAGE_PLANNING` for client/project rate views and `PAYROLL_FINANCE_PERMISSIONS` for finance reads. That fallback should be treated as temporary and documented in code/tests.

## Implementation Branch

Implementation must happen on a feature branch named with the `feature/` prefix, for example:

`feature/billing-rates`

Do not use a `codex/` branch name.

## Initial Migration Policy

The design assumes:

- Function names remain string-based for the first implementation, matching the current planning shift model.
- Employee wages remain contract-based.
- Project rates are copied at project creation time.
- Existing projects are not backfilled automatically in the first implementation.

Existing projects should show missing-rate warnings until an admin adds project billing rates manually. This avoids silently assigning new commercial terms to already-created work. A later bulk-fill admin action can be designed separately if needed.
