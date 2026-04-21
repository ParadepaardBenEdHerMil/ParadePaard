package com.pm.planningservice.repository;

import com.pm.planningservice.model.ClientCompany;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ClientCompanyRepository extends JpaRepository<ClientCompany, UUID> {
    interface ClientCompanyNameView {
        UUID getClientCompanyId();
        String getName();
    }

    List<ClientCompany> findByOwnerCompanyIdOrderByNameAsc(UUID ownerCompanyId);
    Page<ClientCompany> findByOwnerCompanyId(UUID ownerCompanyId, Pageable pageable);

    @Query("""
            select c.clientCompanyId as clientCompanyId, c.name as name
            from ClientCompany c
            where c.ownerCompanyId = :ownerCompanyId
            order by c.name asc
            """)
    List<ClientCompanyNameView> findNameViewsByOwnerCompanyIdOrderByNameAsc(UUID ownerCompanyId);

    @Query("""
            select c.clientCompanyId as clientCompanyId, c.name as name
            from ClientCompany c
            where c.ownerCompanyId = :ownerCompanyId
              and c.clientCompanyId in :clientCompanyIds
            order by c.name asc
            """)
    List<ClientCompanyNameView> findNameViewsByOwnerCompanyIdAndClientCompanyIdInOrderByNameAsc(
            UUID ownerCompanyId,
            Collection<UUID> clientCompanyIds);

    Optional<ClientCompany> findByClientCompanyIdAndOwnerCompanyId(UUID clientCompanyId, UUID ownerCompanyId);

    boolean existsByOwnerCompanyIdAndNameIgnoreCase(UUID ownerCompanyId, String name);

    boolean existsByOwnerCompanyIdAndNameIgnoreCaseAndClientCompanyIdNot(
            UUID ownerCompanyId,
            String name,
            UUID clientCompanyId
    );
}
