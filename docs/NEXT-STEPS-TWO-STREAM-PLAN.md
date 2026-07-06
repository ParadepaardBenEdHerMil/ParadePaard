# Next steps — get `feature/ops-readiness-config` test-green (two parallel streams)

**Goal:** stabilize the branch so the **test suites are green** (they are currently red). This is a
**test-stabilization plan, not full production-readiness** — B1 (git-history purge), B7 (first
admin), S5 (TLS enablement), C1 (junk cleanup), and C6 (package rename) remain open (see "Out of
scope") and must be completed or explicitly accepted as follow-up before the final readiness PR.
The suites are red mainly because the B6 migrations are now full PostgreSQL (pg_dump-faithful) while
the unit/app-context tests run on H2, plus some stale test assertions and a couple of pre-existing
bugs. Do **not** commit the stabilization work until the relevant suites are green.

The work is split into **two streams that touch disjoint files**, so two agents can run in parallel
without conflicts. Read "Shared context" first, then your stream.

---

## Shared context (both streams read this first)

- **Branch:** `feature/ops-readiness-config`. Work in your **own git worktree** off this branch and
  merge back. The two streams own non-overlapping file sets (see below), so merges are clean.
- **Shared files (`docker-compose.yml`, `.env`, root configs):** avoid changing them. If
  investigation (e.g. the integration-test failures) proves a fix genuinely belongs in a shared
  file, **coordinate with the other stream before editing it** and call it out at merge — don't edit
  a shared file silently.
- **Migrations are intentionally full PostgreSQL** (captured via `pg_dump` so Hibernate `validate`
  matches 1:1). **Do NOT rewrite them to be H2-compatible.** Tests must meet the migrations on
  Postgres, not the other way around.
- **Seed layout is fixed:** `V1__init_schema.sql` = schema only; auth-service
  `V2__seed_platform_reference_data.sql` = company/roles/permissions seed. Any test that asserts
  seed data must read **V2**, not V1.
- **B6 is runtime-verified only.** On a clean `docker compose down -v && up`, Flyway applied every
  migration and Hibernate `validate` passed on all services. It is **not** suite-verified — that's
  the point of this work.
- **Testcontainers recipe (use the SAME approach in every service for consistent results):**
  - Add test-scoped deps: `org.testcontainers:postgresql` and
    `org.springframework.boot:spring-boot-testcontainers`.
  - Add a `@TestConfiguration` (imported by the DB/app-context tests) exposing
    `@Bean @ServiceConnection PostgreSQLContainer<>("postgres:16.4")`.
  - Keep `spring.flyway.enabled=true` and `ddl-auto=validate` in tests (mirror prod).
  - Pure web-layer tests (`@WebMvcTest`, no DB) stay DB-less — don't add a container to those.
  - **Confirm Docker/Testcontainers actually works on the target dev/CI environment before relying
    on this** — these tests require a Docker daemon. If Docker isn't available in CI, **stop and
    flag it**: the migration/seed-SQL tests cannot run on H2, so an alternative must be decided
    first (a CI Postgres service container, or a documented Postgres test profile). Do not silently
    fall back to H2 + `ddl-auto=create-drop` for the tests that execute migration SQL.
- **JDK 21.** The Docker image build runs `-DskipTests` (compiles tests, doesn't run them), so run
  `mvn test` locally/CI to actually exercise them.
- **Don't commit until your stream's owned suites are green.**

### What is already done (context, not to redo)
- B6 migrations regenerated (`V1` schema per service, auth `V2` seed); `ddl-auto: validate` +
  `flyway.enabled: true` in the 5 services' `application.yml` and `docker-compose.yml`. Runtime-verified.
- Kafka consumer multi-company fix implemented (`KafkaProducer.java`, `KafkaConsumer.java`, both
  `user_event.proto`) + producer contract test updated. Runtime-verified.
- Leave `LazyInitializationException` fix implemented (`@Transactional` on
  `LeaveRequestServiceImpl`). Existing IDOR/scope tests pass.
- V3 two-company tenant-isolation probe passed live (8/8) but the script is not in the repo.
- All of the above is **uncommitted** in the working tree.

---

## STREAM A — auth-service, api-gateway, planning-service, integration-test, docs

> **STATUS: DONE (2026-07-05). All Stream A suites green:** api-gateway 9/9, planning-service
> 108/108, auth-service 52/52, integration-test 6/6 (ran against the live stack, not skipped).
> Notes: (A2) auth needed **no** Testcontainers — it has no DB/app-context tests; the failing
> "seed" tests are text-file assertions, fixed by pointing them at `V2`. (A4) the redirect filter
> was **not** buggy in production — `MockServerHttpRequest.get(String)` double-encoded the test
> input; fixed the test, reverted the filter. Stream B is still outstanding; do not commit/PR yet.

**Owns (only these paths):**
`Program/microservice/auth-service/**`, `Program/microservice/api-gateway/**`,
`Program/microservice/planning-service/src/test/**`, `Program/microservice/integration-test/**`,
`docs/**`.

1. **Doc: correct the B6 status (quick).** In `docs/PRODUCTION-READINESS-TODO.md`, change the B6
   line from "done & verified" to the accurate scope, e.g.: *"Verified on a clean Postgres compose
   boot (Flyway migrated, Hibernate validate passed); unit/app-context suites broken until tests run
   against Postgres/Testcontainers."*
2. **auth-service test infra:** apply the Testcontainers recipe to any auth DB/app-context test.
3. **Fix stale auth seed tests:** `AuthSeedPermissionsTest.java:80` and `SeedDataScriptTest.java:26`
   read `db/migration/V1__init_schema.sql` for seed rows — seed moved to
   `V2__seed_platform_reference_data.sql`. Point seed assertions at V2 (or run full Flyway on the
   container and assert the resulting DB state); keep schema assertions on V1.
4. **Gateway redirect double-encode bug:** `SecurityHeadersGlobalFilter.httpsRedirectUri()`
   (`api-gateway/.../filter/SecurityHeadersGlobalFilter.java:62`) re-encodes the query, turning
   `?next=%2Fdashboard` into `%252F`. Rebuild the redirect URI from the request's **raw** (already-
   encoded) components so it isn't double-encoded. Make `SecurityHeadersGlobalFilterTest`
   (`filter/SecurityHeadersGlobalFilterTest.java:25-37`) pass.
5. **planning-service JWT_SECRET:** app-context test can't resolve `JWT_SECRET`. Provide a dummy in
   `planning-service/src/test/resources/application*.properties` (or `@DynamicPropertySource`).
6. **integration-test (needs a live stack):** 3 failures — a valid-token route returns 401; two
   protected routes return 404 instead of 401/403. Investigate (likely gateway JWT-validation /
   routing under S2, or stale expectations). Fix code or expectations.
   - **How to start the stack (be explicit so results are reproducible):** from
     `Program/microservice`, run `docker compose up -d` using the local `.env` (it must define
     `JWT_SECRET`, the six `*_SERVICE_DB_PASSWORD`s, `INTERNAL_SERVICE_TOKEN`, and the `SES_*`
     values — the dev `.env` already has these). Wait until `docker compose ps` shows every service
     `healthy`. The suite targets the gateway at `http://localhost:4004` (override via
     `PARADEPAARD_GATEWAY_URL`).
   - **Gotcha:** `IntegrationEnvironment` **skips** the whole suite if the gateway is unreachable, so
     a "pass" can actually be a silent skip. Confirm the tests **ran** (not skipped) before calling
     integration-test green.
7. **Green gate for Stream A:** `mvn test` passes for auth-service, api-gateway, planning-service;
   integration-test **runs (not skipped) and passes** against the freshly booted stack described above.

---

## STREAM B — user-service, contract-service, payroll-service, timesheet-service, frontend

**Owns (only these paths):**
`Program/microservice/user-service/**`, `Program/microservice/contract-service/**`,
`Program/microservice/payroll-service/**`, `Program/microservice/timesheet-service/**`,
`Program/frontend/**`.

1. **Test infra:** apply the Testcontainers recipe to the DB/app-context tests of user-service,
   contract-service, payroll-service, timesheet-service (`@SpringBootTest` /
   `@DataJpaTest(properties="spring.sql.init.mode=never")` currently fall back to H2 and fail on the
   Postgres migrations).
2. **Fix stale user seed / SQL tests:** `user/SeedDataScriptTest.java:26` (seed moved to auth V2 —
   confirm what this test should assert now; user-service has no seed) and
   `user/UserStatusConstraintSqlTest.java:21`, which loads `V1__init_schema.sql` and runs it on H2 —
   run it against the Testcontainers Postgres instead (the migration is now Postgres-only).
3. **Kafka consumer regression test (user-service):** cover the multi-company fix — two distinct
   companies (and a second user in one company) all propagate, each company row gets its **real**
   name (not `"Company"`), and no duplicate-name failure. Guards `KafkaConsumer.uniqueCompanyName`.
4. **Leave `@Transactional` regression test (user-service):** a **non-empty** leave read/list
   returns 200 (previously 500'd via `LazyInitializationException`). Guards the fix in
   `LeaveRequestServiceImpl`.
5. **Frontend (`npm test`, 4 failing):** `src/utils/seedDataCleanSlate.test.ts` couples to the
   V1/V2 seed layout — update to the final layout; the other 3 are stale expectations around
   renamed management UI — update to current components.
6. **Green gate for Stream B:** `mvn test` passes for user/contract/payroll/timesheet; `npm test`
   passes for the frontend.

---

## Non-collision guarantees & the joint final step

- **Disjoint files:** Stream A = auth + gateway + planning-tests + integration-test + docs;
  Stream B = user + contract + payroll + timesheet + frontend. No shared files, no shared parent
  pom. `docker-compose.yml` / `.env` are already done — neither stream changes them.
- **Only logical coupling:** the frontend `seedDataCleanSlate.test.ts` (Stream B) must match the
  V1/V2 seed layout — but that layout is already finalized, so there's no runtime dependency on
  Stream A.
- **Joint final gate (after both merge):** full `docker compose down -v && up` boot with all health
  probes green, integration-test green against the live stack (confirmed **run**, not skipped),
  `mvn verify` per service, `npm test` green. **Only then** commit the test-stabilization work. Do
  **not** open the final production-readiness PR until the deferred readiness items (B1/B7/S5/C1/C6)
  are completed or explicitly accepted as documented follow-up.

## Out of scope for this plan (defer — separate items on the readiness todo)
B1 git-history secret purge; B7 create first admin; S5 enable TLS; C1 delete junk files; C6 package
rename. These are not needed to get the branch green.
