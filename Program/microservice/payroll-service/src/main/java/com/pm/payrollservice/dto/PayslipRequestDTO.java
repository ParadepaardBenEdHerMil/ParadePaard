// PayslipRequestDTO.java
package com.pm.payrollservice.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public class PayslipRequestDTO {
    @NotBlank(message = "userId is required")
    private String userId;
    private String dateOfIssue; // expect ISO yyyy-MM-dd
    private BigDecimal hoursWorked; //TODO use timesheet data

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getDateOfIssue() {
        return dateOfIssue;
    }

    public void setDateOfIssue(String dateOfIssue) {
        this.dateOfIssue = dateOfIssue;
    }

    public BigDecimal getHoursWorked() {
        return hoursWorked;
    }

    public void setHoursWorked(BigDecimal hoursWorked) {
        this.hoursWorked = hoursWorked;
    }
}
