package com.pm.planningservice.repository;

import com.pm.planningservice.model.ShiftApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShiftApplicationRepository extends JpaRepository<ShiftApplication, UUID> {
    List<ShiftApplication> findByUserId(UUID userId);

    List<ShiftApplication> findByShiftIdIn(Collection<UUID> shiftIds);

    Optional<ShiftApplication> findFirstByShiftIdAndUserId(UUID shiftId, UUID userId);

    void deleteByShiftIdIn(Collection<UUID> shiftIds);
}
