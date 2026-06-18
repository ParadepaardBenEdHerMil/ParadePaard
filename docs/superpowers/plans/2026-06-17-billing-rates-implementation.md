# Billing Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build billing-rate management for clients, projects, and employee overrides, with project rates copied from active client defaults at project creation.

**Architecture:** Store billing rates in the planning service because rates are attached to planning clients and projects. Expose protected REST endpoints for client and employee billing-rate views, then consume those endpoints from new frontend billing-rate tabs under existing client and user detail areas. Keep employee wage data out of this feature.

**Tech Stack:** Spring Boot 3.5, JPA, Flyway, JUnit/Mockito, React 19, React Router, Axios, Vitest, TypeScript.

---

### Task 1: Backend Billing Rate Domain

**Files:**
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/model/ClientFunctionBillingRate.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/model/ProjectFunctionBillingRate.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/model/EmployeeClientFunctionBillingRate.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/model/EmployeeProjectFunctionBillingRate.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/repository/ClientFunctionBillingRateRepository.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/repository/ProjectFunctionBillingRateRepository.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/repository/EmployeeClientFunctionBillingRateRepository.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/repository/EmployeeProjectFunctionBillingRateRepository.java`
- Create: `Program/microservice/planning-service/src/main/resources/db/migration/V6__add_billing_rates.sql`
- Modify: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/service/PlanningManagementService.java`
- Modify: `Program/microservice/planning-service/src/test/java/com/pm/planningservice/service/PlanningManagementServiceTest.java`

- [ ] **Step 1: Write the failing project-copy test**

Add `createProjectCopiesActiveClientBillingRates` to `PlanningManagementServiceTest`. The test must create two active client default billing-rate records, call `createProject`, and verify two project billing-rate rows are saved with the saved project id and source default ids.

- [ ] **Step 2: Run the project-copy test to verify it fails**

Run from `Program/microservice/planning-service`: `.\mvnw -Dtest=PlanningManagementServiceTest#createProjectCopiesActiveClientBillingRates test`

Expected: compile failure because billing-rate repositories/entities do not exist yet.

- [ ] **Step 3: Add entities, repositories, and migration**

Create the four JPA entities with UUID ids, company/client/project/user ids, `functionName`, `BigDecimal ratePerHour`, effective timestamps for default and override records, `active`, `notes`, and audit timestamps. Add repository lookup methods for company-scoped lists and active default resolution. Add Flyway tables and indexes in `V6__add_billing_rates.sql`.

- [ ] **Step 4: Wire project-rate copying into `PlanningManagementService`**

Inject `ClientFunctionBillingRateRepository` and `ProjectFunctionBillingRateRepository`. After saving a project, copy active client defaults for the selected client into project-owned rate records.

- [ ] **Step 5: Run the project-copy test to verify it passes**

Run from `Program/microservice/planning-service`: `.\mvnw -Dtest=PlanningManagementServiceTest#createProjectCopiesActiveClientBillingRates test`

Expected: PASS.

### Task 2: Backend Billing Rate API

**Files:**
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/dto/BillingRateDTO.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/dto/BillingRateSaveRequestDTO.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/dto/ClientBillingRatesDTO.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/dto/UserBillingRatesDTO.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/service/BillingRateService.java`
- Create: `Program/microservice/planning-service/src/main/java/com/pm/planningservice/controller/BillingRateController.java`
- Create: `Program/microservice/planning-service/src/test/java/com/pm/planningservice/service/BillingRateServiceTest.java`

- [ ] **Step 1: Write failing service tests**

Create `BillingRateServiceTest` with two tests: `saveClientDefaultRateEndsPreviousActiveVersion` and `listUserBillingRatesReturnsClientAndProjectOverrides`.

- [ ] **Step 2: Run service tests to verify they fail**

Run from `Program/microservice/planning-service`: `.\mvnw -Dtest=BillingRateServiceTest test`

Expected: compile failure because `BillingRateService` does not exist yet.

- [ ] **Step 3: Implement DTOs and service**

Add DTOs for list rows and save requests. Implement client view loading, user view loading, default client rate create/versioning, project rate update/create, client employee override save, and project employee override save.

- [ ] **Step 4: Implement controller with permissions**

Add endpoints under `/planning/billing-rates`. Use `@PreAuthorize("hasAnyAuthority('CAN_VIEW_BILLING_RATES','CAN_MANAGE_BILLING_RATES')")` for reads and `@PreAuthorize("hasAuthority('CAN_MANAGE_BILLING_RATES')")` for writes.

- [ ] **Step 5: Run service tests to verify they pass**

Run from `Program/microservice/planning-service`: `.\mvnw -Dtest=BillingRateServiceTest test`

Expected: PASS.

### Task 3: Frontend Services And Permissions

**Files:**
- Create: `Program/frontend/src/services/user-service/BillingRates.ts`
- Modify: `Program/frontend/src/services/user-service/UserServices.ts`
- Modify: `Program/frontend/src/utils/permissionPolicy.ts`
- Create: `Program/frontend/src/utils/billingRates.ts`
- Create: `Program/frontend/src/utils/billingRates.test.ts`

- [ ] **Step 1: Write failing utility tests**

Create `billingRates.test.ts` with tests for section-count labels and rate-source labels used by billing-rate tables.

- [ ] **Step 2: Run utility tests to verify they fail**

Run from `Program/frontend`: `npm test -- src/utils/billingRates.test.ts`

Expected: compile failure because `billingRates.ts` does not exist.

- [ ] **Step 3: Implement frontend service and permissions**

Add `BILLING_RATE_PERMISSIONS`, include them in management access, expose typed `UserServices` methods, and add utility helpers.

- [ ] **Step 4: Run utility tests to verify they pass**

Run from `Program/frontend`: `npm test -- src/utils/billingRates.test.ts`

Expected: PASS.

### Task 4: Client Billing Rates Page

**Files:**
- Create: `Program/frontend/src/pages/AdminPlanningClientBillingRates.tsx`
- Modify: `Program/frontend/src/pages/AdminPlanningClientDetail.tsx`
- Modify: `Program/frontend/src/App.tsx`
- Modify: `Program/frontend/src/stylesheets/AdminPlanningClients.css`
- Create: `Program/frontend/src/pages/AdminPlanningClientBillingRates.test.tsx`

- [ ] **Step 1: Write failing page test**

Create `AdminPlanningClientBillingRates.test.tsx`. Mock `UserServices.getClientBillingRates`, render the page with outlet context, and assert that default billing rates, project billing rates, and employee overrides sections are present.

- [ ] **Step 2: Run page test to verify it fails**

Run from `Program/frontend`: `npm test -- src/pages/AdminPlanningClientBillingRates.test.tsx`

Expected: compile failure because the page does not exist.

- [ ] **Step 3: Implement page, route, and tab**

Add the `Billing rates` tab under the client detail shell, route it to `/management/clients/:clientCompanyId/billing-rates`, and build compact admin tables with add/edit modals for default rates, project rates, and employee overrides.

- [ ] **Step 4: Run page test to verify it passes**

Run from `Program/frontend`: `npm test -- src/pages/AdminPlanningClientBillingRates.test.tsx`

Expected: PASS.

### Task 5: Employee Billing Rates Page

**Files:**
- Create: `Program/frontend/src/pages/AdminUserBillingRates.tsx`
- Modify: `Program/frontend/src/pages/AdminUserDetails.tsx`
- Modify: `Program/frontend/src/App.tsx`
- Modify: `Program/frontend/src/stylesheets/AdminUserDetails.css`
- Create: `Program/frontend/src/pages/AdminUserBillingRates.test.tsx`

- [ ] **Step 1: Write failing page test**

Create `AdminUserBillingRates.test.tsx`. Mock `UserServices.getUserBillingRates`, render the page, and assert that client-level and project-level employee overrides are shown.

- [ ] **Step 2: Run page test to verify it fails**

Run from `Program/frontend`: `npm test -- src/pages/AdminUserBillingRates.test.tsx`

Expected: compile failure because the page does not exist.

- [ ] **Step 3: Implement page and route integration**

Add a `Billing rates` tab to the user detail area. Keep employee pay language out of the page and show only client/project billing overrides.

- [ ] **Step 4: Run page test to verify it passes**

Run from `Program/frontend`: `npm test -- src/pages/AdminUserBillingRates.test.tsx`

Expected: PASS.

### Task 6: Final Verification And Delivery

**Files:**
- Verify all changed backend, frontend, and plan files.

- [ ] **Step 1: Run backend planning tests**

Run from `Program/microservice/planning-service`: `.\mvnw test`

Expected: PASS.

- [ ] **Step 2: Run frontend tests and build**

Run from `Program/frontend`: `npm test`

Expected: PASS.

Run from `Program/frontend`: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit implementation**

Stage the billing-rate implementation files and commit with message `Add billing rates management`.

- [ ] **Step 4: Push and open PR**

Push `feature/billing-rates` and create a pull request into `main`.
