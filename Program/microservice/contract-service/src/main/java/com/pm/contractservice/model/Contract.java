package com.pm.contractservice.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "contracts")
public class Contract {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(nullable = false)
    private UUID contractId;
    @Column(unique = true, nullable = false)
    private UUID userId;

    // Date
    @Column(nullable = false)
    private LocalDate startDate;
    @Column(nullable = false)
    private LocalDate endDate;

    // Contract Details
    @Column(precision = 19, scale = 2, nullable = false)
    private BigDecimal wageTaxAmountTest;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "contract_functions",
            joinColumns = @JoinColumn(name = "contract_id"),
            inverseJoinColumns = @JoinColumn(name = "function_id")
    )
    private List<Function> functions;

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

    public List<Function> getFunctions() {
        return functions;
    }

    public void setFunctions(List<Function> functions) {
        this.functions = functions;
    }
}