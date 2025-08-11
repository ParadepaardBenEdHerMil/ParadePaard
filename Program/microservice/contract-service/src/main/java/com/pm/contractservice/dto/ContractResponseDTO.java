package com.pm.contractservice.dto;

import com.pm.contractservice.model.Function;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import java.util.List;

public class ContractResponseDTO {

    private UUID contractId;
    private UUID userId;

    // Date
    private LocalDate startDate;
    private LocalDate endDate;

    // Contract Details
    private BigDecimal wageTaxAmountTest; //TODO test tax
    private List<Function> functions;

    public List<Function> getFunctions() {
        return functions;
    }

    public void setFunctions(List<Function> functions) {
        this.functions = functions;
    }

    public UUID getContractId() {
        return contractId;
    }

    public void setContractId(UUID contractId) {
        this.contractId = contractId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getWageTaxAmountTest() {
        return wageTaxAmountTest;
    }

    public void setWageTaxAmountTest(BigDecimal wageTaxAmountTest) {
        this.wageTaxAmountTest = wageTaxAmountTest;
    }


}
