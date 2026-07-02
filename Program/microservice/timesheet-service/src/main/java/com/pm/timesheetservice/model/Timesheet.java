package com.pm.timesheetservice.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "timesheets")
public class Timesheet {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID timesheetId;
    private UUID userId;
    // Employer company that owns this shift/timesheet. Supplied by the planning
    // import (the project's company) so finance can scope by company without a
    // user->company lookup. Legacy rows are null until re-imported.
    @Column(name = "company_id")
    private UUID companyId;
    private String name;

    // Date
    @Column(nullable = false)
    private LocalDate dateOfIssue;
    private Integer weekNumber;
    private Integer weekBasedYear;

    // Timesheet
    private String function;
    @Column(precision = 19, scale = 2)
    private BigDecimal hoursWorked;
    @Column(precision = 19, scale = 2)
    private BigDecimal travelExpenses;

    @Column(unique = true)
    private UUID sourceScheduleEntryId;
    private UUID sourceShiftId;
    private UUID sourceProjectId;
    private String projectName;
    private String shiftName;
    private LocalDate shiftDate;
    private LocalDateTime shiftStartTime;
    private LocalDateTime shiftEndTime;
    private Integer breakMinutes;
    @Column(precision = 19, scale = 2)
    private BigDecimal travelKilometers;
    @Column(precision = 19, scale = 2)
    private BigDecimal travelRate;

    // Approval workflow. A timesheet is born PENDING and is moved exactly once to
    // APPROVED or REJECTED by a manager. Legacy/null rows are treated as PENDING.
    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private TimesheetStatus status = TimesheetStatus.PENDING;

    /** Manager who approved/rejected this timesheet (null while PENDING). */
    private UUID decidedByUserId;

    /** When the approve/reject decision was taken (null while PENDING). */
    private OffsetDateTime decidedAt;

    /** Optional free-text reason captured with the decision. */
    @Column(length = 1000)
    private String decisionReason;

    public UUID getTimesheetId() {
        return timesheetId;
    }

    public void setTimesheetId(UUID timesheetId) {
        this.timesheetId = timesheetId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDate getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(LocalDate dateOfIssue) {
        this.dateOfIssue = dateOfIssue;
    }

    public Integer getWeekNumber() {
        return weekNumber;
    }

    public void setWeekNumber(Integer weekNumber) {
        this.weekNumber = weekNumber;
    }

    public Integer getWeekBasedYear() {
        return weekBasedYear;
    }

    public void setWeekBasedYear(Integer weekBasedYear) {
        this.weekBasedYear = weekBasedYear;
    }

    public String getFunction() {
        return function;
    }

    public void setFunction(String function) {
        this.function = function;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public void setHoursWorked(BigDecimal hoursWorked) {
        this.hoursWorked = hoursWorked;
    }

    public BigDecimal getTravelExpenses() {
        return travelExpenses;
    }

    public void setTravelExpenses(BigDecimal travelExpenses) {
        this.travelExpenses = travelExpenses;
    }

    public UUID getSourceScheduleEntryId() {
        return sourceScheduleEntryId;
    }

    public void setSourceScheduleEntryId(UUID sourceScheduleEntryId) {
        this.sourceScheduleEntryId = sourceScheduleEntryId;
    }

    public UUID getSourceShiftId() {
        return sourceShiftId;
    }

    public void setSourceShiftId(UUID sourceShiftId) {
        this.sourceShiftId = sourceShiftId;
    }

    public UUID getSourceProjectId() {
        return sourceProjectId;
    }

    public void setSourceProjectId(UUID sourceProjectId) {
        this.sourceProjectId = sourceProjectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getShiftName() {
        return shiftName;
    }

    public void setShiftName(String shiftName) {
        this.shiftName = shiftName;
    }

    public LocalDate getShiftDate() {
        return shiftDate;
    }

    public void setShiftDate(LocalDate shiftDate) {
        this.shiftDate = shiftDate;
    }

    public LocalDateTime getShiftStartTime() {
        return shiftStartTime;
    }

    public void setShiftStartTime(LocalDateTime shiftStartTime) {
        this.shiftStartTime = shiftStartTime;
    }

    public LocalDateTime getShiftEndTime() {
        return shiftEndTime;
    }

    public void setShiftEndTime(LocalDateTime shiftEndTime) {
        this.shiftEndTime = shiftEndTime;
    }

    public Integer getBreakMinutes() {
        return breakMinutes;
    }

    public void setBreakMinutes(Integer breakMinutes) {
        this.breakMinutes = breakMinutes;
    }

    public BigDecimal getTravelKilometers() {
        return travelKilometers;
    }

    public void setTravelKilometers(BigDecimal travelKilometers) {
        this.travelKilometers = travelKilometers;
    }

    public BigDecimal getTravelRate() {
        return travelRate;
    }

    public void setTravelRate(BigDecimal travelRate) {
        this.travelRate = travelRate;
    }

    public TimesheetStatus getStatus() {
        return status == null ? TimesheetStatus.PENDING : status;
    }

    public void setStatus(TimesheetStatus status) {
        this.status = status;
    }

    public UUID getDecidedByUserId() {
        return decidedByUserId;
    }

    public void setDecidedByUserId(UUID decidedByUserId) {
        this.decidedByUserId = decidedByUserId;
    }

    public OffsetDateTime getDecidedAt() {
        return decidedAt;
    }

    public void setDecidedAt(OffsetDateTime decidedAt) {
        this.decidedAt = decidedAt;
    }

    public String getDecisionReason() {
        return decisionReason;
    }

    public void setDecisionReason(String decisionReason) {
        this.decisionReason = decisionReason;
    }
}
