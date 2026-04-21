package com.pm.payrollservice.dto;

import java.util.List;

public class CompanySettingsDTO {
    private String companyId;
    private String name;
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

    public List<PayrollTaxTemplateDTO> getPayrollTaxTemplates() {
        return payrollTaxTemplates;
    }

    public void setPayrollTaxTemplates(List<PayrollTaxTemplateDTO> payrollTaxTemplates) {
        this.payrollTaxTemplates = payrollTaxTemplates;
    }
}
