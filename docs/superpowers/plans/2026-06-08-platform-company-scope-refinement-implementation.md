# Platform Company Scope Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the current platform admin implementation so company entry is management-only, platform onboarding generates temporary passwords server-side, admin onboarding keeps using the existing gated setup flow, and seed data starts from only the super-admin company/account baseline.

**Architecture:** Reuse the existing `PlatformAdminContext`, `/platform/*` routes, and auth-service scope switch. Tighten the frontend shell so scoped company mode only exposes management navigation, remove the visible platform banner, and return scoped exits to the company detail page. Update the user-service platform onboarding contract to accept admin suffix and generate credentials through auth-service instead of the browser form, then reduce auth/user seed SQL to a single super-admin baseline.

**Tech Stack:** React, TypeScript, React Router, Vitest, Spring Boot, Spring Security, JUnit 5

---

## File Structure

### Frontend

- Modify: `Program/frontend/src/components/Navbar.tsx`
- Modify: `Program/frontend/src/components/Navbar.test.tsx`
- Modify: `Program/frontend/src/components/PrimaryNav.tsx`
- Modify: `Program/frontend/src/components/PrimaryNav.test.tsx`
- Modify: `Program/frontend/src/context/PlatformAdminContext.tsx`
- Modify: `Program/frontend/src/context/PlatformAdminContext.test.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminOnboarding.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminOnboarding.test.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.test.tsx`
- Modify: `Program/frontend/src/pages/Onboarding.tsx`
- Create: `Program/frontend/src/pages/Onboarding.test.tsx`
- Modify: `Program/frontend/src/services/user-service/Types.ts`
- Modify: `Program/frontend/src/stylesheets/Navbar.css`

### Backend

- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/PlatformCompanyOnboardingRequestDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/PlatformCompanyOnboardingResponseDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/AuthRegisterRequestDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/service/UserService.java`
- Modify: `Program/microservice/user-service/src/test/java/com/pm/userservice/PlatformAdminControllerTest.java`
- Modify: `Program/microservice/user-service/src/test/java/com/pm/userservice/service/PlatformAdminServiceTest.java`
- Modify: `Program/microservice/auth-service/src/main/java/com/pm/authservice/dto/RegisterRequestDTO.java`
- Modify: `Program/microservice/auth-service/src/main/java/com/pm/authservice/service/AuthService.java`
- Modify: `Program/microservice/auth-service/src/main/resources/data.sql`
- Modify: `Program/microservice/user-service/src/main/resources/data.sql`

### Seed/Test Coverage

- Modify: `Program/frontend/src/utils/seedDataCleanSlate.test.ts`

## Task 1: Tighten Frontend Expectations With Failing Tests

**Files:**
- Modify: `Program/frontend/src/pages/PlatformAdminOnboarding.test.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.test.tsx`
- Modify: `Program/frontend/src/components/Navbar.test.tsx`
- Modify: `Program/frontend/src/components/PrimaryNav.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it("renders company onboarding without a temporary password field and includes admin suffix", () => {
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <PlatformAdminOnboarding />
        </MemoryRouter>
    );

    expect(html).toContain("Admin suffix");
    expect(html).not.toContain("Temporary password");
});
```

```tsx
it("renders the refined company entry action copy", () => {
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <PlatformAdminCompanyDetails initialCompany={company} />
        </MemoryRouter>
    );

    expect(html).toContain("Open company management");
    expect(html).not.toContain("Go to management");
});
```

```tsx
it("does not render the platform banner in scoped company mode", () => {
    mockedPlatformAdminContext.mockReturnValueOnce({
        actingCompany: { companyId: "company-1", companyName: "Acme Events" },
        lastScopedCompanyId: "company-1",
        isPlatformAdmin: true,
        startActingAsCompany: vi.fn(),
        stopActingAsCompany: vi.fn(),
    });

    const html = renderToStaticMarkup(
        <MemoryRouter>
            <Navbar />
        </MemoryRouter>
    );

    expect(html).not.toContain("Platform admin mode");
    expect(html).not.toContain("Acting in Acme Events");
});
```

```tsx
it("hides personal links while a platform admin is scoped into another company", () => {
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <PrimaryNav />
        </MemoryRouter>
    );

    expect(html).not.toContain(">My planning</span>");
    expect(html).not.toContain(">Work history</span>");
    expect(html).not.toContain(">Messages</span>");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/pages/PlatformAdminOnboarding.test.tsx src/pages/PlatformAdminCompanyDetails.test.tsx src/components/Navbar.test.tsx src/components/PrimaryNav.test.tsx`

Expected: FAIL because the current UI still renders the password field, old action copy, visible platform banner, and personal links in scoped mode.

- [ ] **Step 3: Write minimal implementation**

Update the platform onboarding form, company detail CTA copy, and primary shell rendering so the tests above pass with the smallest behavior change consistent with the spec.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/pages/PlatformAdminOnboarding.test.tsx src/pages/PlatformAdminCompanyDetails.test.tsx src/components/Navbar.test.tsx src/components/PrimaryNav.test.tsx`

Expected: PASS

## Task 2: Implement Scoped Management-Only Frontend Behavior

**Files:**
- Modify: `Program/frontend/src/context/PlatformAdminContext.tsx`
- Modify: `Program/frontend/src/context/PlatformAdminContext.test.tsx`
- Modify: `Program/frontend/src/components/PrimaryNav.tsx`
- Modify: `Program/frontend/src/components/Navbar.tsx`
- Modify: `Program/frontend/src/pages/PlatformAdminCompanyDetails.tsx`
- Modify: `Program/frontend/src/pages/Onboarding.tsx`
- Create: `Program/frontend/src/pages/Onboarding.test.tsx`
- Modify: `Program/frontend/src/stylesheets/Navbar.css`

- [ ] **Step 1: Write the failing tests**

```tsx
it("preserves the last scoped company id so exit can return to the company detail page", () => {
    expect(
        normalizeActingCompany({ companyId: "company-1", companyName: "Acme Events" })
    ).toEqual({ companyId: "company-1", companyName: "Acme Events" });
});
```

```tsx
it("renders account-setup wording on onboarding for privileged admin users", () => {
    const html = renderToStaticMarkup(<Onboarding />);
    expect(html).toContain("Complete your account setup");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/context/PlatformAdminContext.test.tsx src/pages/Onboarding.test.tsx`

Expected: FAIL because the context does not preserve a detail-page return target and the onboarding copy still uses the generic employee wording.

- [ ] **Step 3: Write minimal implementation**

Implement:

```ts
type PlatformAdminContextValue = {
    actingCompany: ActingCompany | null;
    lastScopedCompanyId: string | null;
    isPlatformAdmin: boolean;
    startActingAsCompany: (company: ActingCompany, redirectTo?: string) => Promise<void>;
    stopActingAsCompany: (redirectTo?: string) => Promise<void>;
};
```

and update the exit behavior to use:

```ts
await stopActingAsCompany(`/platform/companies/${lastScopedCompanyId}`);
```

Also hide personal nav links in `PrimaryNav` whenever `isPlatformAdmin && actingCompany` and replace the onboarding header text with the refined account-setup wording.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/context/PlatformAdminContext.test.tsx src/components/PrimaryNav.test.tsx src/components/Navbar.test.tsx src/pages/PlatformAdminCompanyDetails.test.tsx src/pages/PlatformAdminOnboarding.test.tsx`

Expected: PASS

## Task 3: Move Platform Onboarding To Server-Generated Credentials

**Files:**
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/PlatformCompanyOnboardingRequestDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/PlatformCompanyOnboardingResponseDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/AuthRegisterRequestDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/service/UserService.java`
- Modify: `Program/microservice/user-service/src/test/java/com/pm/userservice/PlatformAdminControllerTest.java`
- Modify: `Program/microservice/user-service/src/test/java/com/pm/userservice/service/PlatformAdminServiceTest.java`
- Modify: `Program/microservice/auth-service/src/main/java/com/pm/authservice/dto/RegisterRequestDTO.java`
- Modify: `Program/microservice/auth-service/src/main/java/com/pm/authservice/service/AuthService.java`
- Modify: `Program/frontend/src/services/user-service/Types.ts`

- [ ] **Step 1: Write the failing tests**

```java
@Test
void onboardPlatformCompanyDelegatesToAuthRegisterWithGeneratedPasswordAndSuffix() {
    PlatformCompanyOnboardingRequestDTO request = new PlatformCompanyOnboardingRequestDTO();
    request.setCompanyName("Acme Events");
    request.setAdminFirstName("Alex");
    request.setAdminMiddleNamePrefix("van");
    request.setAdminLastName("Stone");
    request.setAdminEmail("alex@acme.test");

    PlatformCompanyOnboardingResponseDTO response = service.onboardPlatformCompany(request);

    verify(authServiceClient).register(captor.capture());
    assertThat(captor.getValue().getPassword()).isNotBlank();
    assertThat(captor.getValue().getMiddleNamePrefix()).isEqualTo("van");
    assertThat(response.getGeneratedTemporaryPassword()).isNotBlank();
}
```

```java
@Test
void onboardCompanyReturnsCreatedResponseWithoutRequiringAdminPasswordInput() {
    PlatformCompanyOnboardingRequestDTO request = new PlatformCompanyOnboardingRequestDTO();
    request.setCompanyName("Acme Events");
    request.setAdminFirstName("Alex");
    request.setAdminMiddleNamePrefix("van");
    request.setAdminLastName("Stone");
    request.setAdminEmail("alex@acme.test");

    ResponseEntity<PlatformCompanyOnboardingResponseDTO> response = controller.onboardCompany(request);

    assertThat(response.getStatusCode().value()).isEqualTo(201);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.\mvnw.cmd -Dtest=PlatformAdminControllerTest,PlatformAdminServiceTest test`

Expected: FAIL because the request DTO still requires `adminPassword`, no suffix field exists, and the service passes browser-supplied passwords straight through.

- [ ] **Step 3: Write minimal implementation**

Add `adminMiddleNamePrefix`/`middleNamePrefix` fields to the platform and auth DTOs, generate the temporary password in `UserService`, and return it in `PlatformCompanyOnboardingResponseDTO` for the UI/email handoff. Keep the existing auth-service register path and mark the created auth account with `mustChangePassword`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `.\mvnw.cmd -Dtest=PlatformAdminControllerTest,PlatformAdminServiceTest test`

Expected: PASS

## Task 4: Reduce Seed Data To The Super-Admin Baseline

**Files:**
- Modify: `Program/microservice/auth-service/src/main/resources/data.sql`
- Modify: `Program/microservice/user-service/src/main/resources/data.sql`
- Modify: `Program/frontend/src/utils/seedDataCleanSlate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("keeps only the seeded platform admin in auth seed users", () => {
    expect(authSql).toContain("super.admin@example.com");
    expect(authSql).not.toContain("sanne.admin@example.com");
});
```

```ts
it("keeps only the super-admin company and super-admin user in user-service seeds", () => {
    expect(userSql).toContain("Platform Sandbox Company");
    expect(userSql).toContain("super.admin@example.com");
    expect(userSql).not.toContain("Default Company");
    expect(userSql).not.toContain("sanne.admin@example.com");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/utils/seedDataCleanSlate.test.ts`

Expected: FAIL because both seed scripts still create the standard admin and the extra default company baseline.

- [ ] **Step 3: Write minimal implementation**

Keep only:

```sql
'00000000-0000-0000-0000-000000000001'::uuid, 'Platform Sandbox Company'
```

and the `super.admin@example.com` auth/user records, removing the Sanne admin seed and the separate default company seed entries.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/utils/seedDataCleanSlate.test.ts`

Expected: PASS

## Task 5: Full Verification

**Files:**
- Verify all touched files

- [ ] **Step 1: Run focused frontend tests**

Run: `npm test -- src/components/Navbar.test.tsx src/components/PrimaryNav.test.tsx src/context/PlatformAdminContext.test.tsx src/pages/PlatformAdminOnboarding.test.tsx src/pages/PlatformAdminCompanyDetails.test.tsx src/utils/seedDataCleanSlate.test.ts`

Expected: PASS

- [ ] **Step 2: Run focused backend tests**

Run: `.\mvnw.cmd -Dtest=PlatformAdminControllerTest,PlatformAdminServiceTest test`

Expected: PASS

- [ ] **Step 3: Run a frontend production build**

Run: `npm run build`

Expected: build completes successfully

- [ ] **Step 4: Run project-root git checks**

Run: `git status`

Expected: only the intended implementation files are modified

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: refine platform company scope and onboarding flow"
git push
```
