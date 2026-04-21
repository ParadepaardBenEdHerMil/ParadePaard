package com.pm.planningservice.repository;

import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ScheduleEntryRepository extends JpaRepository<ScheduleEntry, UUID> {
    List<ScheduleEntry> findByUserId(UUID userId);

    List<ScheduleEntry> findByShiftId(UUID shiftId);

    List<ScheduleEntry> findByShiftIdIn(Collection<UUID> shiftIds);

    List<ScheduleEntry> findByShiftIdInAndStatusNot(Collection<UUID> shiftIds, ScheduleEntryStatus status);

    List<ScheduleEntry> findByShiftIdInAndStatusIn(Collection<UUID> shiftIds, Collection<ScheduleEntryStatus> statuses);

    @Query("select se from ScheduleEntry se where se.shiftId in :shiftIds and se.status in :statuses and (se.timesheetExported = false or se.timesheetExported is null)")
    List<ScheduleEntry> findByShiftIdInAndStatusInAndTimesheetExportedFalse(Collection<UUID> shiftIds, Collection<ScheduleEntryStatus> statuses);

    @Query("select se from ScheduleEntry se where se.status in :statuses and (se.timesheetExported = false or se.timesheetExported is null)")
    List<ScheduleEntry> findByStatusInAndTimesheetExportedFalse(Collection<ScheduleEntryStatus> statuses);

    @Query("""
            select se.shiftId as shiftId,
                   sum(case when se.status <> :cancelledStatus then 1 else 0 end) as assignedCount,
                   sum(case when se.status = :confirmedStatus then 1 else 0 end) as checkedInCount
            from ScheduleEntry se
            where se.shiftId in :shiftIds
            group by se.shiftId
            """)
    List<ShiftAssignmentCountView> countAssignmentsByShiftIdIn(
            Collection<UUID> shiftIds,
            ScheduleEntryStatus cancelledStatus,
            ScheduleEntryStatus confirmedStatus);

    Optional<ScheduleEntry> findFirstByShiftIdAndUserId(UUID shiftId, UUID userId);

    interface ShiftAssignmentCountView {
        UUID getShiftId();
        Long getAssignedCount();
        Long getCheckedInCount();
    }
}
