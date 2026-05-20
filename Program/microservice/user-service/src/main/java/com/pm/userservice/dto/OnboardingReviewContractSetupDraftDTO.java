package com.pm.userservice.dto;

public class OnboardingReviewContractSetupDraftDTO {
    private String selectedFunctionId;
    private String functionName;
    private String contractType;
    private String startDate;
    private String endDate;
    private String grossHourlyWage;
    private String paymentFrequency;
    private Boolean travelAllowance;

    public String getSelectedFunctionId() {
        return selectedFunctionId;
    }

    public void setSelectedFunctionId(String selectedFunctionId) {
        this.selectedFunctionId = selectedFunctionId;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public String getContractType() {
        return contractType;
    }

    public void setContractType(String contractType) {
        this.contractType = contractType;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public void setEndDate(String endDate) {
        this.endDate = endDate;
    }

    public String getGrossHourlyWage() {
        return grossHourlyWage;
    }

    public void setGrossHourlyWage(String grossHourlyWage) {
        this.grossHourlyWage = grossHourlyWage;
    }

    public String getPaymentFrequency() {
        return paymentFrequency;
    }

    public void setPaymentFrequency(String paymentFrequency) {
        this.paymentFrequency = paymentFrequency;
    }

    public Boolean getTravelAllowance() {
        return travelAllowance;
    }

    public void setTravelAllowance(Boolean travelAllowance) {
        this.travelAllowance = travelAllowance;
    }
}

