package com.pm.contractservice.dto;

import jakarta.validation.constraints.NotBlank;

public class FunctionRequestDTO {
    @NotBlank(message = "functionName is required")
    private String functionName;

    private String department;

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

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}
