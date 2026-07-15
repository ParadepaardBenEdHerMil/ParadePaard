package com.pm.userservice.repository;

import com.pm.userservice.model.EmailPreset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmailPresetRepository extends JpaRepository<EmailPreset, UUID> {
    List<EmailPreset> findByCompanyIdOrderByGroupTypeAscNameAsc(UUID companyId);

    // Company-scoped lookup so one company can never read or mutate another company's presets.
    Optional<EmailPreset> findByIdAndCompanyId(UUID id, UUID companyId);
}
