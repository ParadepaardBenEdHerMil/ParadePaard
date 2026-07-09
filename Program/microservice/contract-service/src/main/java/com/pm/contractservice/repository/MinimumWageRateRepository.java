package com.pm.contractservice.repository;

import com.pm.contractservice.model.MinimumWageRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface MinimumWageRateRepository extends JpaRepository<MinimumWageRate, UUID> {

    List<MinimumWageRate> findAllByOrderByEffectiveFromAscMinimumAgeAsc();

    void deleteByEffectiveFrom(LocalDate effectiveFrom);
}
