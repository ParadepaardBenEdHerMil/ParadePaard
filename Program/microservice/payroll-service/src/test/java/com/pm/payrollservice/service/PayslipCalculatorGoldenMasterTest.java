package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.model.Payslip;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cent-exact golden masters for the payslip engine (G-4 / PY-1, PY-1b, PY-3, PY-17, PY-2).
 *
 * <p>Money math is asserted to the exact cent with {@code isEqualByComparingTo}, never a
 * tolerance. The gross/net arithmetic here is the independent reference (computed by hand in
 * the comments); statutory withholding is delegated to {@link LoonheffingCalculator}, which is
 * pinned to the 2026 Handboek figures by its own tests.
 */
class PayslipCalculatorGoldenMasterTest {

    private static final DutchPayrollTaxRates RATES = DutchPayrollTaxRates.forYear(2026);

    /** PY-1b: travel is paid out (net) but never inflates the fiscal/taxable wage. */
    @Test
    void travelIsExcludedFromFiscalWageButAddedToNet() {
        Payslip p = base();
        p.setTotalHoursWorked(new BigDecimal("10"));
        p.setHourlyWage(new BigDecimal("20"));        // 10 * 20 = 200.00 gross
        p.setTravelExpenses(new BigDecimal("15"));
        p.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                line("LOONHEFFING", "TAX", "FIXED_AMOUNT", "40", 10)
        )));

        PayslipCalculator.apply(p);

        assertThat(p.getTotalGrossAmount()).isEqualByComparingTo("200.00");
        assertThat(p.getFiscalWage()).isEqualByComparingTo("200.00");   // == gross, travel excluded
        assertThat(p.getTravelExpenses()).isEqualByComparingTo("15.00");
        assertThat(p.getTotalEmployeeDeductions()).isEqualByComparingTo("40.00");
        assertThat(p.getTotalNetAmount()).isEqualByComparingTo("175.00"); // 200 - 40 + 15
    }

    /** PY-1: a travel-only period with zero hours (and a blank date of birth) pays out travel. */
    @Test
    void zeroHoursTravelOnlyPeriodPaysTravelWithNoTax() {
        Payslip p = base();
        p.setDateOfBirth(null);                        // PY-1 edge: blank DoB must not crash
        p.setTotalHoursWorked(new BigDecimal("0"));
        p.setHourlyWage(new BigDecimal("20"));
        p.setTravelExpenses(new BigDecimal("30"));

        PayslipCalculator.apply(p);

        assertThat(p.getTotalGrossAmount()).isEqualByComparingTo("0.00");
        assertThat(p.getFiscalWage()).isEqualByComparingTo("0.00");
        assertThat(p.getTotalEmployeeDeductions()).isEqualByComparingTo("0.00");
        assertThat(p.getTotalNetAmount()).isEqualByComparingTo("30.00");
    }

    /** TC cap: reimbursement above EUR 0.23/km splits into a taxable excess and a tax-free remainder. */
    @Test
    void travelAboveTaxFreeCapInflatesFiscalWageOnlyByTheExcess() {
        Payslip p = base();
        p.setTotalHoursWorked(new BigDecimal("10"));
        p.setHourlyWage(new BigDecimal("20"));        // 200.00 wage gross
        p.setTravelExpenses(new BigDecimal("30.00")); // 100 km at 0.30/km
        p.setTravelKilometers(new BigDecimal("100.00"));

        PayslipCalculator.apply(p);

        assertThat(p.getTotalGrossAmount()).isEqualByComparingTo("207.00");  // 200.00 + taxable excess 7.00
        assertThat(p.getFiscalWage()).isEqualByComparingTo("207.00");
        assertThat(p.getTravelExpenses()).isEqualByComparingTo("30.00");
        assertThat(p.getTotalEmployeeDeductions()).isEqualByComparingTo("0.00");
        assertThat(p.getTotalNetAmount()).isEqualByComparingTo("230.00");    // gross 207.00 + tax-free 23.00
    }

    /** PY-3: net = gross - all deductions + travel; pension (pre-tax) lowers the fiscal wage. */
    @Test
    void netReconcilesAcrossMixedDeductions() {
        Payslip p = base();
        p.setTotalHoursWorked(new BigDecimal("40"));
        p.setHourlyWage(new BigDecimal("15"));         // 40 * 15 = 600.00 gross
        p.setTravelExpenses(BigDecimal.ZERO);
        p.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                line("PENSION_EMPLOYEE", "PENSION", "PERCENT_OF_GROSS", "5", 20),  // 600 * 5% = 30.00 pre-tax
                line("LOONHEFFING", "TAX", "FIXED_AMOUNT", "100", 10),             // 100.00
                line("HEALTH", "OTHER", "FIXED_AMOUNT", "20", 30)                  // 20.00
        )));

        PayslipCalculator.apply(p);

        assertThat(p.getTotalGrossAmount()).isEqualByComparingTo("600.00");
        assertThat(p.getFiscalWage()).isEqualByComparingTo("570.00");          // 600 - 30 pension
        assertThat(p.getTotalEmployeeDeductions()).isEqualByComparingTo("150.00"); // 30 + 100 + 20
        assertThat(p.getLoonheffingWithheld()).isEqualByComparingTo("100.00");
        assertThat(p.getTotalNetAmount()).isEqualByComparingTo("450.00");      // 600 - 150 + 0
    }

    /** PY-17: money is rounded HALF_UP to the cent on both gross and percentage lines. */
    @Test
    void roundsHalfUpToTheCent() {
        Payslip p = base();
        p.setTotalHoursWorked(new BigDecimal("1"));
        p.setHourlyWage(new BigDecimal("20.005"));     // 20.005 -> HALF_UP -> 20.01
        p.setTravelExpenses(BigDecimal.ZERO);
        p.setDeductionLinesJson(PayslipDeductionCodec.write(List.of(
                line("PENSION_EMPLOYEE", "PENSION", "PERCENT_OF_GROSS", "33.33", 20) // 20.01 * 33.33% = 6.669333 -> 6.67
        )));

        PayslipCalculator.apply(p);

        assertThat(p.getTotalGrossAmount()).isEqualByComparingTo("20.01");
        assertThat(findLine(p, "PENSION_EMPLOYEE").getCalculatedAmount()).isEqualByComparingTo("6.67");
        assertThat(p.getFiscalWage()).isEqualByComparingTo("13.34");           // 20.01 - 6.67 pre-tax
        assertThat(p.getTotalNetAmount()).isEqualByComparingTo("13.34");       // 20.01 - 6.67
    }

    /** PY-2 / F-2: employer levies are computed from the same rate source, not invented. */
    @Test
    void employerLeviesMatchRateReference() {
        Payslip p = base();
        p.setTotalHoursWorked(new BigDecimal("10"));
        p.setHourlyWage(new BigDecimal("20"));         // 200.00 gross
        p.setTravelExpenses(BigDecimal.ZERO);

        PayslipCalculator.apply(p);

        int periods = LoonheffingCalculator.periodsPerYear("WEEKLY");
        BigDecimal expectedZvw = LoonheffingCalculator.periodEmployerZvw(new BigDecimal("200.00"), periods, RATES);
        BigDecimal expectedInsurance =
                LoonheffingCalculator.periodEmployerInsurancePremiums(new BigDecimal("200.00"), periods, RATES);

        assertThat(p.getEmployerZvwLevy()).isEqualByComparingTo(expectedZvw);
        assertThat(p.getEmployerInsurancePremiums()).isEqualByComparingTo(expectedInsurance);
        assertThat(expectedZvw).isGreaterThan(BigDecimal.ZERO);
        assertThat(expectedInsurance).isGreaterThan(BigDecimal.ZERO);
    }

    // ---- helpers ----

    private static Payslip base() {
        Payslip p = new Payslip();
        p.setDateOfIssue(LocalDate.parse("2026-06-01"));
        p.setWeekBasedYear(2026);
        p.setDateOfBirth(LocalDate.parse("1995-05-05"));
        p.setPaymentFrequency("WEEKLY");
        p.setApplyLoonheffingskorting(Boolean.TRUE);
        p.setTravelExpenses(BigDecimal.ZERO);
        return p;
    }

    private static PayrollDeductionLineDTO line(String code, String category, String calcType,
                                                String configuredValue, int sortOrder) {
        PayrollDeductionLineDTO l = new PayrollDeductionLineDTO();
        l.setCode(code);
        l.setLabel(code);
        l.setCategory(category);
        l.setCalculationType(calcType);
        if (configuredValue != null) {
            l.setConfiguredValue(new BigDecimal(configuredValue));
        }
        l.setSortOrder(sortOrder);
        return l;
    }

    private static PayrollDeductionLineDTO findLine(Payslip payslip, String code) {
        return PayslipDeductionCodec.read(payslip.getDeductionLinesJson()).stream()
                .filter(l -> code.equalsIgnoreCase(l.getCode()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("expected deduction line " + code));
    }
}
