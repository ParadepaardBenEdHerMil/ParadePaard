package com.pm.userservice.integration;

import java.math.BigDecimal;

public class RuleReplacementContractRequestDTO {
    private String userId;
    private String effectiveFrom;
    private String ruleVersionId;
    private BigDecimal grossHourlyWage;
    private BigDecimal holidayAllowancePercentage;
    private String collectiveAgreement;
    private String pensionScheme;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public String getRuleVersionId() {
        return ruleVersionId;
    }

    public void setRuleVersionId(String ruleVersionId) {
        this.ruleVersionId = ruleVersionId;
    }

    public BigDecimal getGrossHourlyWage() {
        return grossHourlyWage;
    }

    public void setGrossHourlyWage(BigDecimal grossHourlyWage) {
        this.grossHourlyWage = grossHourlyWage;
    }

    public BigDecimal getHolidayAllowancePercentage() {
        return holidayAllowancePercentage;
    }

    public void setHolidayAllowancePercentage(BigDecimal holidayAllowancePercentage) {
        this.holidayAllowancePercentage = holidayAllowancePercentage;
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
}
