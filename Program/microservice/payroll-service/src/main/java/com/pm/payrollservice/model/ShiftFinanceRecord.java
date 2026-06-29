package com.pm.payrollservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Materialised per-shift finance record. ESTIMATED rows are computed on read;
 * once a released/approved payslip covers a shift's pay period the row is
 * recomputed as ACTUAL (payslip employer cost allocated across the period's
 * shifts pro-rata by gross wage), snapshotted here and locked. A locked record
 * is the immutable source of truth and is returned verbatim on later reads.
 */
@Entity
@Table(name = "shift_finance_records",
        uniqueConstraints = @UniqueConstraint(name = "uk_shift_finance_timesheet", columnNames = "timesheet_id"))
public class ShiftFinanceRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "timesheet_id", nullable = false)
    private UUID timesheetId;
    @Column(name = "company_id")
    private UUID companyId;
    @Column(name = "user_id")
    private UUID userId;
    @Column(name = "project_id")
    private UUID projectId;
    @Column(name = "client_company_id")
    private UUID clientCompanyId;
    @Column(name = "function_name")
    private String functionName;
    @Column(name = "project_name")
    private String projectName;
    @Column(name = "client_name")
    private String clientName;
    @Column(name = "shift_date")
    private LocalDate shiftDate;
    @Column(name = "pay_period_key")
    private String payPeriodKey;

    @Column(precision = 19, scale = 2)
    private BigDecimal hours;
    @Column(name = "hourly_wage", precision = 19, scale = 2)
    private BigDecimal hourlyWage;
    @Column(name = "gross_wage", precision = 19, scale = 2)
    private BigDecimal grossWage;
    @Column(name = "holiday_allowance", precision = 19, scale = 2)
    private BigDecimal holidayAllowance;
    @Column(name = "employer_zvw", precision = 19, scale = 2)
    private BigDecimal employerZvw;
    @Column(name = "employer_premiums", precision = 19, scale = 2)
    private BigDecimal employerInsurancePremiums;
    @Column(name = "total_employer_cost", precision = 19, scale = 2)
    private BigDecimal totalEmployerCost;
    @Column(name = "rate_per_hour", precision = 19, scale = 2)
    private BigDecimal ratePerHour;
    @Column(name = "client_revenue", precision = 19, scale = 2)
    private BigDecimal clientRevenue;
    @Column(precision = 19, scale = 2)
    private BigDecimal margin;
    @Column(name = "margin_percentage", precision = 19, scale = 2)
    private BigDecimal marginPercentage;
    @Column(name = "margin_status")
    private String marginStatus;
    @Column(name = "rate_source")
    private String rateSource;
    private String tag;
    private boolean locked;
    @Column(name = "payslip_id")
    private UUID payslipId;
    @Column(name = "created_at")
    private OffsetDateTime createdAt;
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTimesheetId() { return timesheetId; }
    public void setTimesheetId(UUID v) { this.timesheetId = v; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID v) { this.companyId = v; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID v) { this.userId = v; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID v) { this.projectId = v; }
    public UUID getClientCompanyId() { return clientCompanyId; }
    public void setClientCompanyId(UUID v) { this.clientCompanyId = v; }
    public String getFunctionName() { return functionName; }
    public void setFunctionName(String v) { this.functionName = v; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String v) { this.projectName = v; }
    public String getClientName() { return clientName; }
    public void setClientName(String v) { this.clientName = v; }
    public LocalDate getShiftDate() { return shiftDate; }
    public void setShiftDate(LocalDate v) { this.shiftDate = v; }
    public String getPayPeriodKey() { return payPeriodKey; }
    public void setPayPeriodKey(String v) { this.payPeriodKey = v; }
    public BigDecimal getHours() { return hours; }
    public void setHours(BigDecimal v) { this.hours = v; }
    public BigDecimal getHourlyWage() { return hourlyWage; }
    public void setHourlyWage(BigDecimal v) { this.hourlyWage = v; }
    public BigDecimal getGrossWage() { return grossWage; }
    public void setGrossWage(BigDecimal v) { this.grossWage = v; }
    public BigDecimal getHolidayAllowance() { return holidayAllowance; }
    public void setHolidayAllowance(BigDecimal v) { this.holidayAllowance = v; }
    public BigDecimal getEmployerZvw() { return employerZvw; }
    public void setEmployerZvw(BigDecimal v) { this.employerZvw = v; }
    public BigDecimal getEmployerInsurancePremiums() { return employerInsurancePremiums; }
    public void setEmployerInsurancePremiums(BigDecimal v) { this.employerInsurancePremiums = v; }
    public BigDecimal getTotalEmployerCost() { return totalEmployerCost; }
    public void setTotalEmployerCost(BigDecimal v) { this.totalEmployerCost = v; }
    public BigDecimal getRatePerHour() { return ratePerHour; }
    public void setRatePerHour(BigDecimal v) { this.ratePerHour = v; }
    public BigDecimal getClientRevenue() { return clientRevenue; }
    public void setClientRevenue(BigDecimal v) { this.clientRevenue = v; }
    public BigDecimal getMargin() { return margin; }
    public void setMargin(BigDecimal v) { this.margin = v; }
    public BigDecimal getMarginPercentage() { return marginPercentage; }
    public void setMarginPercentage(BigDecimal v) { this.marginPercentage = v; }
    public String getMarginStatus() { return marginStatus; }
    public void setMarginStatus(String v) { this.marginStatus = v; }
    public String getRateSource() { return rateSource; }
    public void setRateSource(String v) { this.rateSource = v; }
    public String getTag() { return tag; }
    public void setTag(String v) { this.tag = v; }
    public boolean isLocked() { return locked; }
    public void setLocked(boolean v) { this.locked = v; }
    public UUID getPayslipId() { return payslipId; }
    public void setPayslipId(UUID v) { this.payslipId = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime v) { this.createdAt = v; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime v) { this.updatedAt = v; }
}
