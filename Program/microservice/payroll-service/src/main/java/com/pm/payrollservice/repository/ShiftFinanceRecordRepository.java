package com.pm.payrollservice.repository;

import com.pm.payrollservice.model.ShiftFinanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShiftFinanceRecordRepository extends JpaRepository<ShiftFinanceRecord, UUID> {
    List<ShiftFinanceRecord> findByCompanyIdAndShiftDateBetween(UUID companyId, LocalDate from, LocalDate to);
    Optional<ShiftFinanceRecord> findByTimesheetId(UUID timesheetId);
}
