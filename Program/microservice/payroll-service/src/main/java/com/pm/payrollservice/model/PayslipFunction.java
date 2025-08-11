package com.pm.payrollservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.math.BigDecimal;
import java.util.UUID;

@Embeddable
public class PayslipFunction {
    @Column(nullable = false)
    private UUID functionId;
    @Column(nullable = false)
    private String functionName;
    @Column(precision = 19, scale = 2, nullable = false)
    private BigDecimal hourlyWage;

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

    public BigDecimal getHourlyWage() {
        return hourlyWage;
    }

    public void setHourlyWage(BigDecimal hourlyWage) {
        this.hourlyWage = hourlyWage;
    }

}
