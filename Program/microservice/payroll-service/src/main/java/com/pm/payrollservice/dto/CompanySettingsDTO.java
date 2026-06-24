package com.pm.payrollservice.dto;

import java.util.List;

public class CompanySettingsDTO {
    private String companyId;
    private String name;
    private String street;
    private String postalCode;
    private String city;
    private List<PayrollTaxTemplateDTO> payrollTaxTemplates;

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
        this.companyId = companyId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getStreet() {
        return street;
    }

    public void setStreet(String street) {
        this.street = street;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public List<PayrollTaxTemplateDTO> getPayrollTaxTemplates() {
        return payrollTaxTemplates;
    }

    public void setPayrollTaxTemplates(List<PayrollTaxTemplateDTO> payrollTaxTemplates) {
        this.payrollTaxTemplates = payrollTaxTemplates;
    }
}
