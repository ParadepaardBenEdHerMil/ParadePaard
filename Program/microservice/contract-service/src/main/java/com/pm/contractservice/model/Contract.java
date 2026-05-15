package com.pm.contractservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "contracts")
public class Contract {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID contractId;
    @Column(nullable = false)
    private UUID userId;

    private UUID functionId;

    private String functionName;

    // Date
    @Column(nullable = false)
    private LocalDate startDate;
    @Column
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ContractType contractType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContractStatus status = ContractStatus.DRAFT;

    @Column(precision = 19, scale = 2, nullable = false)
    private BigDecimal grossHourlyWage;

    @Column(nullable = false)
    private Boolean travelAllowance;

    @Enumerated(EnumType.STRING)
    @Column(length = 40, nullable = false)
    private PaymentFrequency paymentFrequency = PaymentFrequency.WEEKLY;

    @Column(precision = 5, scale = 2)
    private BigDecimal weeklyHours;

    @Column(precision = 5, scale = 2)
    private BigDecimal holidayAllowancePercentage = new BigDecimal("8.00");

    private Integer leaveEntitlementDays;

    @Column(length = 255)
    private String workLocation;

    @Column(length = 255)
    private String probationPeriod;

    @Column(length = 255)
    private String noticePeriod;

    @Column(length = 255)
    private String collectiveAgreement;

    @Column(length = 255)
    private String pensionScheme;

    @Column(length = 1000)
    private String sicknessPolicy;

    @Column(length = 1000)
    private String confidentialityClause;

    @Column(length = 2000)
    private String reviewComment;

    private OffsetDateTime sentToEmployeeAt;
    private OffsetDateTime employeeSignedAt;
    private OffsetDateTime finalizedAt;
    private OffsetDateTime rejectedAt;

    private UUID signedUserId;

    @Column(length = 255)
    private String typedSignatureName;

    @Column(columnDefinition = "text")
    private String drawnSignatureImage;

    @Column(length = 255)
    private String agreementCheckboxText;

    @Column(length = 100)
    private String contractVersion;

    @Column(length = 128)
    private String documentHash;

    @Column(length = 100)
    private String ipAddress;

    @Column(length = 1000)
    private String browserUserAgent;

    private UUID employerSignedUserId;

    @Column(length = 255)
    private String employerTypedSignatureName;

    @Column(columnDefinition = "text")
    private String employerDrawnSignatureImage;

    @Column(length = 255)
    private String employerAgreementCheckboxText;

    @Column(length = 100)
    private String employerContractVersion;

    @Column(length = 128)
    private String employerDocumentHash;

    @Column(length = 100)
    private String employerIpAddress;

    @Column(length = 1000)
    private String employerBrowserUserAgent;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(columnDefinition = "bytea")
    private byte[] pdfData;

    public UUID getContractId() {
        return contractId;
    }

    public void setContractId(UUID contractId) {
        this.contractId = contractId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public UUID getFunctionId() {
        return functionId;
    }

    public void setFunctionId(UUID functionId) {
        this.functionId = functionId;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public ContractType getContractType() {
        return contractType;
    }

    public void setContractType(ContractType contractType) {
        this.contractType = contractType;
    }

    public ContractStatus getStatus() {
        return status;
    }

    public void setStatus(ContractStatus status) {
        this.status = status;
    }

    public BigDecimal getGrossHourlyWage() {
        return grossHourlyWage;
    }

    public void setGrossHourlyWage(BigDecimal grossHourlyWage) {
        this.grossHourlyWage = grossHourlyWage;
    }

    public Boolean getTravelAllowance() {
        return travelAllowance;
    }

    public void setTravelAllowance(Boolean travelAllowance) {
        this.travelAllowance = travelAllowance;
    }

    public PaymentFrequency getPaymentFrequency() {
        return paymentFrequency;
    }

    public void setPaymentFrequency(PaymentFrequency paymentFrequency) {
        this.paymentFrequency = paymentFrequency == null ? PaymentFrequency.WEEKLY : paymentFrequency;
    }

    public BigDecimal getWeeklyHours() {
        return weeklyHours;
    }

    public void setWeeklyHours(BigDecimal weeklyHours) {
        this.weeklyHours = weeklyHours;
    }

    public BigDecimal getHolidayAllowancePercentage() {
        return holidayAllowancePercentage;
    }

    public void setHolidayAllowancePercentage(BigDecimal holidayAllowancePercentage) {
        this.holidayAllowancePercentage = holidayAllowancePercentage;
    }

    public Integer getLeaveEntitlementDays() {
        return leaveEntitlementDays;
    }

    public void setLeaveEntitlementDays(Integer leaveEntitlementDays) {
        this.leaveEntitlementDays = leaveEntitlementDays;
    }

    public String getWorkLocation() {
        return workLocation;
    }

    public void setWorkLocation(String workLocation) {
        this.workLocation = workLocation;
    }

    public String getProbationPeriod() {
        return probationPeriod;
    }

    public void setProbationPeriod(String probationPeriod) {
        this.probationPeriod = probationPeriod;
    }

    public String getNoticePeriod() {
        return noticePeriod;
    }

    public void setNoticePeriod(String noticePeriod) {
        this.noticePeriod = noticePeriod;
    }

    public String getCollectiveAgreement() {
        return collectiveAgreement;
    }

    public void setCollectiveAgreement(String collectiveAgreement) {
        this.collectiveAgreement = collectiveAgreement;
    }

    public String getPensionScheme() {
        return pensionScheme;
    }

    public void setPensionScheme(String pensionScheme) {
        this.pensionScheme = pensionScheme;
    }

    public String getSicknessPolicy() {
        return sicknessPolicy;
    }

    public void setSicknessPolicy(String sicknessPolicy) {
        this.sicknessPolicy = sicknessPolicy;
    }

    public String getConfidentialityClause() {
        return confidentialityClause;
    }

    public void setConfidentialityClause(String confidentialityClause) {
        this.confidentialityClause = confidentialityClause;
    }

    public String getReviewComment() {
        return reviewComment;
    }

    public void setReviewComment(String reviewComment) {
        this.reviewComment = reviewComment;
    }

    public OffsetDateTime getSentToEmployeeAt() {
        return sentToEmployeeAt;
    }

    public void setSentToEmployeeAt(OffsetDateTime sentToEmployeeAt) {
        this.sentToEmployeeAt = sentToEmployeeAt;
    }

    public OffsetDateTime getEmployeeSignedAt() {
        return employeeSignedAt;
    }

    public void setEmployeeSignedAt(OffsetDateTime employeeSignedAt) {
        this.employeeSignedAt = employeeSignedAt;
    }

    public OffsetDateTime getFinalizedAt() {
        return finalizedAt;
    }

    public void setFinalizedAt(OffsetDateTime finalizedAt) {
        this.finalizedAt = finalizedAt;
    }

    public OffsetDateTime getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(OffsetDateTime rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    public UUID getSignedUserId() {
        return signedUserId;
    }

    public void setSignedUserId(UUID signedUserId) {
        this.signedUserId = signedUserId;
    }

    public String getTypedSignatureName() {
        return typedSignatureName;
    }

    public void setTypedSignatureName(String typedSignatureName) {
        this.typedSignatureName = typedSignatureName;
    }

    public String getDrawnSignatureImage() {
        return drawnSignatureImage;
    }

    public void setDrawnSignatureImage(String drawnSignatureImage) {
        this.drawnSignatureImage = drawnSignatureImage;
    }

    public String getAgreementCheckboxText() {
        return agreementCheckboxText;
    }

    public void setAgreementCheckboxText(String agreementCheckboxText) {
        this.agreementCheckboxText = agreementCheckboxText;
    }

    public String getContractVersion() {
        return contractVersion;
    }

    public void setContractVersion(String contractVersion) {
        this.contractVersion = contractVersion;
    }

    public String getDocumentHash() {
        return documentHash;
    }

    public void setDocumentHash(String documentHash) {
        this.documentHash = documentHash;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getBrowserUserAgent() {
        return browserUserAgent;
    }

    public void setBrowserUserAgent(String browserUserAgent) {
        this.browserUserAgent = browserUserAgent;
    }

    public UUID getEmployerSignedUserId() {
        return employerSignedUserId;
    }

    public void setEmployerSignedUserId(UUID employerSignedUserId) {
        this.employerSignedUserId = employerSignedUserId;
    }

    public String getEmployerTypedSignatureName() {
        return employerTypedSignatureName;
    }

    public void setEmployerTypedSignatureName(String employerTypedSignatureName) {
        this.employerTypedSignatureName = employerTypedSignatureName;
    }

    public String getEmployerDrawnSignatureImage() {
        return employerDrawnSignatureImage;
    }

    public void setEmployerDrawnSignatureImage(String employerDrawnSignatureImage) {
        this.employerDrawnSignatureImage = employerDrawnSignatureImage;
    }

    public String getEmployerAgreementCheckboxText() {
        return employerAgreementCheckboxText;
    }

    public void setEmployerAgreementCheckboxText(String employerAgreementCheckboxText) {
        this.employerAgreementCheckboxText = employerAgreementCheckboxText;
    }

    public String getEmployerContractVersion() {
        return employerContractVersion;
    }

    public void setEmployerContractVersion(String employerContractVersion) {
        this.employerContractVersion = employerContractVersion;
    }

    public String getEmployerDocumentHash() {
        return employerDocumentHash;
    }

    public void setEmployerDocumentHash(String employerDocumentHash) {
        this.employerDocumentHash = employerDocumentHash;
    }

    public String getEmployerIpAddress() {
        return employerIpAddress;
    }

    public void setEmployerIpAddress(String employerIpAddress) {
        this.employerIpAddress = employerIpAddress;
    }

    public String getEmployerBrowserUserAgent() {
        return employerBrowserUserAgent;
    }

    public void setEmployerBrowserUserAgent(String employerBrowserUserAgent) {
        this.employerBrowserUserAgent = employerBrowserUserAgent;
    }

    public byte[] getPdfData() {
        return pdfData;
    }

    public void setPdfData(byte[] pdfData) {
        this.pdfData = pdfData;
    }
}
