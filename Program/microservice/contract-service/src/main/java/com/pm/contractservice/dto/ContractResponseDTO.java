package com.pm.contractservice.dto;

import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.ContractStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class ContractResponseDTO {

    private UUID contractId;
    private UUID userId;
    private UUID functionId;
    private String functionName;

    // Date
    private LocalDate startDate;
    private LocalDate endDate;

    private ContractType contractType;
    private ContractStatus status;
    private BigDecimal grossHourlyWage;
    private Boolean travelAllowance;
    private String paymentFrequency;
    private BigDecimal weeklyHours;
    private BigDecimal holidayAllowancePercentage;
    private Integer leaveEntitlementDays;
    private String workLocation;
    private String probationPeriod;
    private String noticePeriod;
    private String collectiveAgreement;
    private String pensionScheme;
    private String sicknessPolicy;
    private String confidentialityClause;
    private String reviewComment;
    private String sentToEmployeeAt;
    private String employeeSignedAt;
    private String finalizedAt;
    private String rejectedAt;
    private UUID signedUserId;
    private String typedSignatureName;
    private String drawnSignatureImage;
    private String agreementCheckboxText;
    private String contractVersion;
    private String documentHash;
    private String ipAddress;
    private String browserUserAgent;
    private UUID employerSignedUserId;
    private String employerTypedSignatureName;
    private String employerDrawnSignatureImage;
    private String employerAgreementCheckboxText;
    private String employerContractVersion;
    private String employerDocumentHash;
    private String employerIpAddress;
    private String employerBrowserUserAgent;

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

    public String getPaymentFrequency() {
        return paymentFrequency;
    }

    public void setPaymentFrequency(String paymentFrequency) {
        this.paymentFrequency = paymentFrequency;
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

    public String getSentToEmployeeAt() {
        return sentToEmployeeAt;
    }

    public void setSentToEmployeeAt(String sentToEmployeeAt) {
        this.sentToEmployeeAt = sentToEmployeeAt;
    }

    public String getEmployeeSignedAt() {
        return employeeSignedAt;
    }

    public void setEmployeeSignedAt(String employeeSignedAt) {
        this.employeeSignedAt = employeeSignedAt;
    }

    public String getFinalizedAt() {
        return finalizedAt;
    }

    public void setFinalizedAt(String finalizedAt) {
        this.finalizedAt = finalizedAt;
    }

    public String getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(String rejectedAt) {
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
}
