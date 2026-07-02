package com.pm.timesheetservice.repository;

import com.pm.timesheetservice.model.TimesheetAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TimesheetAuditRepository extends JpaRepository<TimesheetAudit, UUID> {
    List<TimesheetAudit> findByTimesheetIdOrderByAtAsc(UUID timesheetId);
}
