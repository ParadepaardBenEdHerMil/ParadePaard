package com.pm.userservice.dto;

public class OnboardingReviewContractSetupDraftDTO {
    private String selectedFunctionId;
    private String functionName;
    private String contractType;
    private String startDate;
    private String endDate;
    private String grossHourlyWage;
    private String hoursPerWeek;
    private String paymentFrequency;
    private Boolean travelAllowance;
    private Boolean employerAgreementChecked;
    private String employerTypedSignatureName;
    private String employerDrawnSignatureImage;

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

    public String getHoursPerWeek() {
        return hoursPerWeek;
    }

    public void setHoursPerWeek(String hoursPerWeek) {
        this.hoursPerWeek = hoursPerWeek;
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

    public Boolean getEmployerAgreementChecked() {
        return employerAgreementChecked;
    }

    public void setEmployerAgreementChecked(Boolean employerAgreementChecked) {
        this.employerAgreementChecked = employerAgreementChecked;
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
}

