package com.pm.contractservice.dto;

import com.pm.contractservice.model.Function;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public class ContractRequestDTO {
    @NotBlank(message = "userId is required")
    private String userId;

    // Date
    @NotBlank(message = "startDate is required")
    private String startDate;
    @NotBlank(message = "endDate is required")
    private String endDate;

    // Contract Details
    @NotNull(message = "wageTaxAmountTest is required")
    private BigDecimal wageTaxAmountTest; //TODO test tax
    @NotEmpty(message = "functions list cannot be empty")
    private List<String> functions;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
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

    public BigDecimal getWageTaxAmountTest() {
        return wageTaxAmountTest;
    }

    public void setWageTaxAmountTest(BigDecimal wageTaxAmountTest) {
        this.wageTaxAmountTest = wageTaxAmountTest;
    }

    public List<String> getFunctions() {
        return functions;
    }

    public void setFunctions(List<String> functions) {
        this.functions = functions;
    }
}