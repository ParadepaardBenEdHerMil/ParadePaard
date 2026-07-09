package com.pm.contractservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Seeds the canonical statutory minimum wage schedule into {@code minimum_wage_rates} on
 * startup if the table is empty. Keeps a single copy of the numbers (the in-code defaults)
 * while making the schedule editable and enforced from the database.
 */
@Component
public class MinimumWageSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MinimumWageSeeder.class);

    private final MinimumWageService minimumWageService;

    public MinimumWageSeeder(MinimumWageService minimumWageService) {
        this.minimumWageService = minimumWageService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            minimumWageService.seedDefaultsIfEmpty();
        } catch (RuntimeException ex) {
            // Non-fatal: resolution falls back to the in-code defaults when the table is
            // empty, so a failed seed must not stop the service from booting.
            log.warn("Could not seed the minimum wage schedule on startup: {}", ex.getMessage());
        }
    }
}
