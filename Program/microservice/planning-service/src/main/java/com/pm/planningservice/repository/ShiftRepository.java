package com.pm.planningservice.repository;

import com.pm.planningservice.model.Shift;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ShiftRepository extends JpaRepository<Shift, UUID> {
    List<Shift> findByEventId(UUID eventId);

    List<Shift> findByEventIdIn(Collection<UUID> eventIds);

    List<Shift> findByEventIdInAndStartTimeLessThanAndEndTimeGreaterThan(
            Collection<UUID> eventIds,
            LocalDateTime endExclusive,
            LocalDateTime startInclusive);

    List<Shift> findByStartTimeGreaterThanEqualAndStartTimeLessThan(LocalDateTime startInclusive, LocalDateTime endExclusive);

    List<Shift> findByEndTimeLessThanEqual(LocalDateTime endInclusive);
}
