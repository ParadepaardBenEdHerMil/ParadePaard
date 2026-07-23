package com.pm.contractservice.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class FunctionRequestDTO {
    @NotBlank(message = "functionName is required")
    private String functionName;

    private String department;

    // Columns name + hourly_wage are NOT NULL, so reject bad payloads here instead of at the DB.
    @NotNull(message = "hourlyWage is required")
    @DecimalMin(value = "0.0", message = "hourlyWage must not be negative")
    private BigDecimal hourlyWage;

    private Boolean active;

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public BigDecimal getHourlyWage() {
        return hourlyWage;
    }

    public void setHourlyWage(BigDecimal hourlyWage) {
        this.hourlyWage = hourlyWage;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
