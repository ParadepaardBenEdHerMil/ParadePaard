package com.pm.planningservice.repository;

import com.pm.planningservice.model.ClientFunctionBillingRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ClientFunctionBillingRateRepository extends JpaRepository<ClientFunctionBillingRate, UUID> {
    List<ClientFunctionBillingRate> findByCompanyIdAndClientCompanyIdOrderByFunctionNameAscEffectiveFromDesc(
            UUID companyId,
            UUID clientCompanyId
    );

    List<ClientFunctionBillingRate> findByCompanyIdAndClientCompanyIdAndActiveTrueOrderByFunctionNameAsc(
            UUID companyId,
            UUID clientCompanyId
    );

    Optional<ClientFunctionBillingRate> findFirstByCompanyIdAndClientCompanyIdAndFunctionNameIgnoreCaseAndActiveTrue(
            UUID companyId,
            UUID clientCompanyId,
            String functionName
    );
}
