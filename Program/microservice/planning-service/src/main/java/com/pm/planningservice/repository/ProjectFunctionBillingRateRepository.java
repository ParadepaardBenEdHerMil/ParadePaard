package com.pm.planningservice.repository;

import com.pm.planningservice.model.ProjectFunctionBillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectFunctionBillingRateRepository extends JpaRepository<ProjectFunctionBillingRate, UUID> {
    List<ProjectFunctionBillingRate> findByCompanyIdAndClientCompanyIdOrderByProjectIdAscFunctionNameAsc(
            UUID companyId,
            UUID clientCompanyId
    );

    List<ProjectFunctionBillingRate> findByCompanyIdAndProjectIdOrderByFunctionNameAsc(
            UUID companyId,
            UUID projectId
    );

    Optional<ProjectFunctionBillingRate> findFirstByCompanyIdAndProjectIdAndFunctionNameIgnoreCase(
            UUID companyId,
            UUID projectId,
            String functionName
    );
}
