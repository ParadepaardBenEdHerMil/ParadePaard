package com.pm.payrollservice.mapper;

import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PayslipMapperTest {

    @Test
    void toDtoHandlesMissingOptionalFields() {
        Payslip payslip = new Payslip();
        payslip.setPayslipId(UUID.randomUUID());
        payslip.setStatus(PayslipStatus.PENDING_REVIEW);
        payslip.setTotalHoursWorked(new BigDecimal("1.10"));
        payslip.setTravelExpenses(BigDecimal.ZERO);

        var dto = PayslipMapper.toDTO(payslip);

        assertEquals(PayslipStatus.PENDING_REVIEW.name(), dto.getStatus());
        assertEquals("1.10", dto.getTotalHoursWorked().toPlainString());
        assertNull(dto.getDateOfIssue());
        assertNull(dto.getUserId());
        assertNull(dto.getStartDate());
        assertNull(dto.getDateOfBirth());
    }
}
