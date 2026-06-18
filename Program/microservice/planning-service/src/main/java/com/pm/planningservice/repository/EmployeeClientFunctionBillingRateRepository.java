package com.pm.planningservice.repository;

import com.pm.planningservice.model.EmployeeClientFunctionBillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeClientFunctionBillingRateRepository extends JpaRepository<EmployeeClientFunctionBillingRate, UUID> {
    List<EmployeeClientFunctionBillingRate> findByCompanyIdAndClientCompanyIdOrderByFunctionNameAsc(
            UUID companyId,
            UUID clientCompanyId
    );

    List<EmployeeClientFunctionBillingRate> findByCompanyIdAndUserIdOrderByFunctionNameAsc(
            UUID companyId,
            UUID userId
    );

    Optional<EmployeeClientFunctionBillingRate> findFirstByCompanyIdAndClientCompanyIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue(
            UUID companyId,
            UUID clientCompanyId,
            UUID userId,
            String functionName
    );
}
