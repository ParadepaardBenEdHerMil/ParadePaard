package com.pm.planningservice.repository;

import com.pm.planningservice.model.EmployeeProjectFunctionBillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeProjectFunctionBillingRateRepository extends JpaRepository<EmployeeProjectFunctionBillingRate, UUID> {
    void deleteByCompanyIdAndClientCompanyId(UUID companyId, UUID clientCompanyId);

    List<EmployeeProjectFunctionBillingRate> findByCompanyIdAndClientCompanyIdOrderByProjectIdAscFunctionNameAsc(
            UUID companyId,
            UUID clientCompanyId
    );

    List<EmployeeProjectFunctionBillingRate> findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(
            UUID companyId,
            UUID userId
    );

    Optional<EmployeeProjectFunctionBillingRate> findFirstByCompanyIdAndProjectIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue(
            UUID companyId,
            UUID projectId,
            UUID userId,
            String functionName
    );
}
