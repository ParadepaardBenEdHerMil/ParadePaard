package com.pm.planningservice.repository;

import com.pm.planningservice.model.ClientCompany;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClientCompanyRepository extends JpaRepository<ClientCompany, UUID> {
    List<ClientCompany> findByOwnerCompanyIdOrderByNameAsc(UUID ownerCompanyId);

    Optional<ClientCompany> findByClientCompanyIdAndOwnerCompanyId(UUID clientCompanyId, UUID ownerCompanyId);

    boolean existsByOwnerCompanyIdAndNameIgnoreCase(UUID ownerCompanyId, String name);
}
