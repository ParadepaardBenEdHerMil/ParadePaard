package com.pm.planningservice.repository;

import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ScheduleEntryRepository extends JpaRepository<ScheduleEntry, UUID> {
    List<ScheduleEntry> findByShiftId(UUID shiftId);

    List<ScheduleEntry> findByShiftIdIn(Collection<UUID> shiftIds);

    List<ScheduleEntry> findByShiftIdInAndStatusNot(Collection<UUID> shiftIds, ScheduleEntryStatus status);

    List<ScheduleEntry> findByShiftIdInAndStatusIn(Collection<UUID> shiftIds, Collection<ScheduleEntryStatus> statuses);
}
