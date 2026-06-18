package com.pm.planningservice.repository;

import com.pm.planningservice.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProjectRepository extends JpaRepository<Project, UUID> {
    List<Project> findByCompanyIdOrderByStartDateAsc(UUID companyId);

    List<Project> findByCompanyIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateAsc(
            UUID companyId,
            java.time.LocalDate endDate,
            java.time.LocalDate startDate);

    Optional<Project> findByProjectIdAndCompanyId(UUID projectId, UUID companyId);

    List<Project> findByProjectIdIn(Collection<UUID> projectIds);

    boolean existsByCompanyIdAndClientCompanyId(UUID companyId, UUID clientCompanyId);
}
