-- V2: editable, date-aware statutory Dutch minimum wage schedule.
--
-- Single source of truth that ContractService.validateMinimumHourlyWage enforces and
-- the Horeca payroll rules page edits. One row per (effective_from, minimum_age); the
-- service groups rows by effective_from into a schedule. The table is created empty and
-- seeded from the in-code defaults on startup (MinimumWageSeeder) so there is one copy
-- of the canonical numbers. Matches the MinimumWageRate entity 1:1 (ddl-auto=validate).

CREATE TABLE public.minimum_wage_rates (
    id uuid NOT NULL,
    effective_from date NOT NULL,
    minimum_age integer NOT NULL,
    hourly_rate numeric(19,2) NOT NULL
);

ALTER TABLE ONLY public.minimum_wage_rates
    ADD CONSTRAINT minimum_wage_rates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.minimum_wage_rates
    ADD CONSTRAINT minimum_wage_rates_effective_age_key UNIQUE (effective_from, minimum_age);
