package com.pm.contractservice.service.pdf;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.PdfWriter;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.pm.contractservice.dto.UserProfileDTO;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ContractPdfGeneratorTest {

    @Test
    void generatesDownloadableEmploymentAgreementWithEmployeeSignature() throws Exception {
        Contract contract = new Contract();
        contract.setContractId(UUID.randomUUID());
        contract.setUserId(UUID.randomUUID());
        contract.setFunctionName("Runner");
        contract.setStartDate(LocalDate.of(2026, 5, 14));
        contract.setEndDate(LocalDate.of(2027, 5, 14));
        contract.setContractType(ContractType.FIXED_HOURS);
        contract.setGrossHourlyWage(new BigDecimal("18.75"));
        contract.setPaymentFrequency(PaymentFrequency.BIWEEKLY);
        contract.setWorkLocation("As agreed with the employer");
        contract.setWeeklyHours(null);
        contract.setHolidayAllowancePercentage(new BigDecimal("8"));
        contract.setLeaveEntitlementDays(20);
        contract.setTravelAllowance(true);
        contract.setProbationPeriod("-");
        contract.setNoticePeriod("Statutory Dutch notice periods apply unless otherwise agreed in writing.");
        contract.setCollectiveAgreement("-");
        contract.setPensionScheme("-");
        contract.setSicknessPolicy("The employee must report sickness according to the employer's absence policy and Dutch employment rules.");
        contract.setStatus(ContractStatus.SIGNED);
        contract.setTypedSignatureName("Imre Clemens van Rhee");
        contract.setEmployeeSignedAt(OffsetDateTime.parse("2026-05-14T12:30:00+02:00"));
        contract.setEmployerTypedSignatureName("Mara Manager");
        contract.setFinalizedAt(OffsetDateTime.parse("2026-05-15T05:51:00+02:00"));

        UserProfileDTO profile = new UserProfileDTO();
        profile.setFirstNames("Imre Clemens");
        profile.setMiddleNamePrefix("van");
        profile.setLastName("Rhee");
        profile.setEmail("employee@example.com");
        profile.setMobileNumber("0615351030");
        profile.setStreetName("Eerste Tuindwarsstraat");
        profile.setHouseNumber("15");
        profile.setPostalCode("1015RT");
        profile.setCity("AMSTERDAM");
        profile.setCountry("Netherlands");

        String pdfText = extractText(new ContractPdfGenerator().generate(contract, profile));

        assertThat(pdfText).contains("Employment Agreement");
        assertThat(pdfText).contains("This employment agreement is entered into between ParadePaard and Imre Clemens van Rhee.");
        assertThat(pdfText).contains("Payment is processed biweekly unless a later written agreement changes the payroll timing.");
        assertThat(pdfText.replaceAll("\\s+", " "))
                .contains("Travel allowance is included when applicable under the Horeca Payroll and Contract Rules.");
        assertThat(pdfText).doesNotContain("employee@example.com");
        assertThat(pdfText).contains("Employer signature");
        assertThat(pdfText).contains("Mara Manager");
        assertThat(pdfText).contains("Employee signature");
        assertThat(pdfText).contains("Imre Clemens van Rhee");
    }

    @Test
    void locksFinalizedPdfAgainstContentModification() throws Exception {
        Contract contract = new Contract();
        contract.setContractId(UUID.randomUUID());
        contract.setUserId(UUID.randomUUID());
        contract.setFunctionName("Runner");
        contract.setStartDate(LocalDate.of(2026, 5, 14));
        contract.setContractType(ContractType.FIXED_HOURS);
        contract.setGrossHourlyWage(new BigDecimal("18.75"));
        contract.setPaymentFrequency(PaymentFrequency.BIWEEKLY);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setTypedSignatureName("Imre Clemens van Rhee");
        contract.setEmployeeSignedAt(OffsetDateTime.parse("2026-05-14T12:30:00+02:00"));
        contract.setEmployerTypedSignatureName("Mara Manager");
        contract.setFinalizedAt(OffsetDateTime.parse("2026-05-15T05:51:00+02:00"));

        UserProfileDTO profile = new UserProfileDTO();
        profile.setFirstNames("Imre Clemens");
        profile.setMiddleNamePrefix("van");
        profile.setLastName("Rhee");

        PdfReader reader = new PdfReader(new ContractPdfGenerator().generate(contract, profile));

        assertThat(reader.isEncrypted()).isTrue();
        assertThat(reader.getPermissions() & PdfWriter.ALLOW_MODIFY_CONTENTS).isZero();
        assertThat(reader.getPermissions() & PdfWriter.ALLOW_MODIFY_ANNOTATIONS).isZero();
        reader.close();
    }

    @Test
    void rendersFourWeeklyPaymentFrequencyAsNaturalLanguage() throws Exception {
        Contract contract = new Contract();
        contract.setContractId(UUID.randomUUID());
        contract.setUserId(UUID.randomUUID());
        contract.setFunctionName("Runner");
        contract.setStartDate(LocalDate.of(2026, 1, 5));
        contract.setContractType(ContractType.FIXED_HOURS);
        contract.setGrossHourlyWage(new BigDecimal("18.75"));
        contract.setPaymentFrequency(PaymentFrequency.FOUR_WEEKLY);
        contract.setStatus(ContractStatus.DRAFT);

        UserProfileDTO profile = new UserProfileDTO();
        profile.setFirstNames("Imre");
        profile.setLastName("Rhee");

        String pdfText = extractText(new ContractPdfGenerator().generate(contract, profile));

        assertThat(pdfText).contains("Payment is processed every 4 weeks unless a later written agreement changes the payroll timing.");
    }

    private static String extractText(byte[] pdfData) throws Exception {
        PdfReader reader = new PdfReader(pdfData);
        PdfTextExtractor extractor = new PdfTextExtractor(reader);
        StringBuilder text = new StringBuilder();
        for (int page = 1; page <= reader.getNumberOfPages(); page++) {
            text.append(extractor.getTextFromPage(page));
        }
        reader.close();
        return text.toString();
    }
}
