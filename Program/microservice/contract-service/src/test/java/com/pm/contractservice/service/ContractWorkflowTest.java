package com.pm.contractservice.service;

import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.testsupport.PostgresTestContainerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(properties = "spring.sql.init.mode=never")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PostgresTestContainerConfig.class)
class ContractWorkflowTest {
    @Autowired
    private ContractRepository contractRepository;

    @Test
    void finalizedContractIsPayrollActiveButEmployeeSignedContractIsNot() {
        UUID userId = UUID.randomUUID();

        Contract employeeSigned = contract(userId, ContractStatus.EMPLOYEE_SIGNED, LocalDate.of(2026, 5, 1));
        Contract finalized = contract(userId, ContractStatus.FINALIZED, LocalDate.of(2026, 5, 10));
        contractRepository.save(employeeSigned);
        contractRepository.save(finalized);

        var active = contractRepository.findPayrollActiveForPeriod(
                userId,
                LocalDate.of(2026, 5, 12),
                LocalDate.of(2026, 5, 12)
        );

        assertThat(active).hasSize(1);
        assertThat(active.getFirst().getStatus()).isEqualTo(ContractStatus.FINALIZED);
    }

    private static Contract contract(UUID userId, ContractStatus status, LocalDate startDate) {
        Contract contract = new Contract();
        contract.setUserId(userId);
        contract.setStartDate(startDate);
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setStatus(status);
        contract.setGrossHourlyWage(new BigDecimal("18.50"));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        return contract;
    }
}
