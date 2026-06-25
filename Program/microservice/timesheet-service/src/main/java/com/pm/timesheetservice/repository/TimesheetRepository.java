package com.pm.timesheetservice.repository;

import com.pm.timesheetservice.model.Timesheet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TimesheetRepository extends JpaRepository<Timesheet, UUID> {
    Optional<Timesheet> findByUserId(UUID userId);
    Optional<Timesheet> findBySourceScheduleEntryId(UUID sourceScheduleEntryId);
    List<Timesheet> findByUserIdAndWeekNumberAndWeekBasedYear(UUID userId, Integer weekNumber, Integer weekBasedYear);
    // Company + shift-date range read used by the revenue/margin assembly (Phase 2).
    List<Timesheet> findByCompanyIdAndShiftDateBetweenOrderByShiftDateAsc(UUID companyId, LocalDate from, LocalDate to);
    List<Timesheet> findByUserIdOrderByDateOfIssueDesc(UUID userId);
    Page<Timesheet> findAllByOrderByDateOfIssueDesc(Pageable pageable);
    Page<Timesheet> findByUserIdOrderByDateOfIssueDesc(UUID userId, Pageable pageable);
}
