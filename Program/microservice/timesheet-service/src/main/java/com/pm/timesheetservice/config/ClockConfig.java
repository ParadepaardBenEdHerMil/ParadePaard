package com.pm.timesheetservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    /**
     * System UTC clock for production. Tests inject a fixed clock directly into
     * {@code TimesheetService} so decision timestamps are deterministic.
     */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
