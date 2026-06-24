package com.pm.payrollservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A finalized (locked) jaaropgaaf for one employee and year. The presence of a
 * row means the year was finalized by the employer: the figures are frozen, the
 * rendered PDF is stored for retention (>= 7 years), and the employee/admin
 * downloads this exact document instead of a live provisional one.
 */
@Entity
@Table(name = "jaaropgaven", uniqueConstraints = @UniqueConstraint(
        name = "uk_jaaropgaaf_company_user_year",
        columnNames = {"company_id", "user_id", "year"}))
public class Jaaropgaaf {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "year", nullable = false)
    private int year;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    private JaaropgaafStatus status = JaaropgaafStatus.FINAL;

    @Column(name = "fiscal_wage", precision = 19, scale = 2)
    private BigDecimal fiscalWage;
    @Column(name = "loonheffing", precision = 19, scale = 2)
    private BigDecimal loonheffing;
    @Column(name = "total_net", precision = 19, scale = 2)
    private BigDecimal totalNet;

    @Column(name = "snapshot_json", columnDefinition = "TEXT")
    private String snapshotJson;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "pdf_data", columnDefinition = "bytea")
    private byte[] pdfData;

    private OffsetDateTime finalizedAt;
    private UUID finalizedByUserId;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public int getYear() { return year; }
    public void setYear(int year) { this.year = year; }

    public JaaropgaafStatus getStatus() { return status; }
    public void setStatus(JaaropgaafStatus status) { this.status = status; }

    public BigDecimal getFiscalWage() { return fiscalWage; }
    public void setFiscalWage(BigDecimal fiscalWage) { this.fiscalWage = fiscalWage; }

    public BigDecimal getLoonheffing() { return loonheffing; }
    public void setLoonheffing(BigDecimal loonheffing) { this.loonheffing = loonheffing; }

    public BigDecimal getTotalNet() { return totalNet; }
    public void setTotalNet(BigDecimal totalNet) { this.totalNet = totalNet; }

    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String snapshotJson) { this.snapshotJson = snapshotJson; }

    public byte[] getPdfData() { return pdfData; }
    public void setPdfData(byte[] pdfData) { this.pdfData = pdfData; }

    public OffsetDateTime getFinalizedAt() { return finalizedAt; }
    public void setFinalizedAt(OffsetDateTime finalizedAt) { this.finalizedAt = finalizedAt; }

    public UUID getFinalizedByUserId() { return finalizedByUserId; }
    public void setFinalizedByUserId(UUID finalizedByUserId) { this.finalizedByUserId = finalizedByUserId; }
}
