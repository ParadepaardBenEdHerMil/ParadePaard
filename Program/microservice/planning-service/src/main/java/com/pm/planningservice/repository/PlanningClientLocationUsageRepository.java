package com.pm.planningservice.repository;

import com.pm.planningservice.model.PlanningClientLocationUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PlanningClientLocationUsageRepository extends JpaRepository<PlanningClientLocationUsage, UUID> {
    Optional<PlanningClientLocationUsage> findByClientCompanyIdAndLocationId(UUID clientCompanyId, UUID locationId);

    List<PlanningClientLocationUsage> findByClientCompanyIdAndLocationIdIn(UUID clientCompanyId, Collection<UUID> locationIds);

    List<PlanningClientLocationUsage> findByLocationIdIn(Collection<UUID> locationIds);

    List<PlanningClientLocationUsage> findByLocationId(UUID locationId);

    void deleteByLocationId(UUID locationId);

    void deleteByClientCompanyId(UUID clientCompanyId);
}
