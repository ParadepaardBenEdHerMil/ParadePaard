package com.pm.contractservice.service.pdf;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Image;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import com.pm.contractservice.dto.UserProfileDTO;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

@Component
public class ContractPdfGenerator {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy - HH:mm");

    public byte[] generate(Contract contract, UserProfileDTO userProfile) {
        Document document = new Document();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        try {
            PdfWriter writer = PdfWriter.getInstance(document, outputStream);
            lockFinalPdf(contract, writer);
            document.open();

            String employeeName = fullName(userProfile);
            String endDateText = contract.getEndDate() == null
                    ? "and continues until ended according to this agreement"
                    : "and ends on " + formatDate(contract.getEndDate());

            document.add(new Paragraph("Employment contract"));
            document.add(new Paragraph("Employment Agreement"));
            document.add(new Paragraph("This employment agreement is entered into between ParadePaard and " + employeeName + ". "
                    + "The agreement starts on " + formatDate(contract.getStartDate()) + " " + endDateText + "."));
            addSpacer(document);

            addSection(document, "1. Parties");
            document.add(new Paragraph("The employer is ParadePaard. The employee is " + employeeName
                    + addressText(userProfile) + "." + contactText(userProfile)));

            addSection(document, "2. Position and Work");
            document.add(new Paragraph("The employee will work in the position of " + displayValue(contract.getFunctionName())
                    + ". The work location is " + displayValue(contract.getWorkLocation())
                    + ". The contract type is " + formatContractType(contract.getContractType())
                    + ". The employee is expected to follow reasonable planning instructions, event procedures, and workplace rules that apply to ParadePaard assignments."));

            addSection(document, "3. Pay and Payroll");
            document.add(new Paragraph("The gross hourly wage is EUR " + formatDecimal(contract.getGrossHourlyWage())
                    + ". The expected working time is " + formatWorkingTime(contract)
                    + ". Payment is processed " + formatPaymentFrequency(contract.getPaymentFrequency())
                    + " unless a later written agreement changes the payroll timing."));
            document.add(new Paragraph("Holiday allowance is " + formatPercentage(contract.getHolidayAllowancePercentage())
                    + ". Leave entitlement is " + formatLeaveEntitlement(contract)
                    + ". Travel allowance is " + formatTravelAllowance(contract) + "."));

            addSection(document, "4. Employment Terms");
            document.add(new Paragraph("The probation period is " + displayValue(contract.getProbationPeriod())
                    + ". The notice period is " + displayValue(contract.getNoticePeriod())
                    + ". Any applicable collective agreement is " + displayValue(contract.getCollectiveAgreement())
                    + ". Pension participation is " + displayValue(contract.getPensionScheme()) + "."));
            document.add(new Paragraph("If the employee is sick, the employee must follow this sickness policy: "
                    + displayValue(contract.getSicknessPolicy()) + "."));

            addSection(document, "5. Confidentiality");
            document.add(new Paragraph(confidentialityText(contract)));

            addSection(document, "6. Signing");
            document.add(new Paragraph("By signing this agreement, the employee confirms that the contract has been read, the personal and employment details have been checked, and the employee agrees to the terms above."));
            addSpacer(document);
            addSignatureBlock(
                    document,
                    "Employer",
                    contract.getEmployerTypedSignatureName(),
                    contract.getFinalizedAt(),
                    contract.getEmployerDrawnSignatureImage()
            );
            addSignatureBlock(
                    document,
                    "Employee",
                    contract.getTypedSignatureName(),
                    contract.getEmployeeSignedAt(),
                    contract.getDrawnSignatureImage()
            );

            document.close();
            return outputStream.toByteArray();
        } catch (DocumentException e) {
            throw new IllegalStateException("Failed to generate PDF", e);
        }
    }

    private static void addSection(Document document, String title) throws DocumentException {
        addSpacer(document);
        document.add(new Paragraph(title));
    }

    private static void addSpacer(Document document) throws DocumentException {
        document.add(new Paragraph(" "));
    }

    private static String addressText(UserProfileDTO profile) {
        String address = formatAddress(profile);
        return address.isBlank() ? "" : ", living at " + address;
    }

    private static String contactText(UserProfileDTO profile) {
        return isBlank(profile.getMobileNumber()) ? "" : " The employee can be contacted by phone at " + profile.getMobileNumber().trim() + ".";
    }

    private static void lockFinalPdf(Contract contract, PdfWriter writer) throws DocumentException {
        if (contract.getStatus() != ContractStatus.FINALIZED) {
            return;
        }
        byte[] ownerPassword = ("contract-owner-" + contract.getContractId()).getBytes(StandardCharsets.UTF_8);
        writer.setEncryption(
                null,
                ownerPassword,
                PdfWriter.ALLOW_PRINTING | PdfWriter.ALLOW_SCREENREADERS,
                PdfWriter.STANDARD_ENCRYPTION_128
        );
    }

    private static String formatWorkingTime(Contract contract) {
        return contract.getWeeklyHours() == null
                ? "as scheduled and agreed"
                : formatDecimal(contract.getWeeklyHours()) + " hours per week";
    }

    private static String formatLeaveEntitlement(Contract contract) {
        return contract.getLeaveEntitlementDays() == null
                ? "handled according to Dutch employment rules"
                : contract.getLeaveEntitlementDays() + " days per year";
    }

    private static String formatTravelAllowance(Contract contract) {
        return Boolean.TRUE.equals(contract.getTravelAllowance())
                ? "included when applicable under the Horeca Payroll and Contract Rules"
                : "not included unless agreed separately";
    }

    private static String confidentialityText(Contract contract) {
        if (!isBlank(contract.getConfidentialityClause())) {
            return contract.getConfidentialityClause().trim();
        }
        return "The employee must handle company, client, planning, payroll, and event information confidentially and may not share it outside the work context.";
    }

    private static void addSignatureBlock(
            Document document,
            String label,
            String typedSignatureName,
            OffsetDateTime signedAt,
            String drawnSignatureImage
    ) throws DocumentException {
        document.add(new Paragraph(label + " signature"));
        addDrawnSignature(document, drawnSignatureImage);
        document.add(new Paragraph("Signature line: __________________________"));
        document.add(new Paragraph(label + " signature: " + signatureText(typedSignatureName)));
        document.add(new Paragraph("Signed on: " + formatDateTime(signedAt)));
        addSpacer(document);
    }

    private static String signatureText(String typedSignatureName) {
        return isBlank(typedSignatureName) ? "-" : typedSignatureName.trim();
    }

    private static void addDrawnSignature(Document document, String drawnSignatureImage) throws DocumentException {
        if (isBlank(drawnSignatureImage)) {
            return;
        }
        try {
            String data = drawnSignatureImage.trim();
            int commaIndex = data.indexOf(',');
            if (data.startsWith("data:image") && commaIndex >= 0) {
                data = data.substring(commaIndex + 1);
            }
            Image image = Image.getInstance(Base64.getDecoder().decode(data));
            image.scaleToFit(220, 80);
            document.add(new Paragraph("Drawn signature:"));
            document.add(image);
        } catch (Exception ignored) {
            document.add(new Paragraph("Drawn signature: stored with this contract but could not be rendered in the PDF."));
        }
    }

    private static String fullName(UserProfileDTO profile) {
        StringBuilder sb = new StringBuilder();
        if (profile.getFirstNames() != null && !profile.getFirstNames().isBlank()) {
            sb.append(profile.getFirstNames());
        }
        if (profile.getMiddleNamePrefix() != null && !profile.getMiddleNamePrefix().isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(profile.getMiddleNamePrefix());
        }
        if (profile.getLastName() != null && !profile.getLastName().isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(profile.getLastName());
        }
        if (sb.length() == 0) {
            return nullSafe(profile.getPreferredName());
        }
        return sb.toString();
    }

    private static String formatAddress(UserProfileDTO profile) {
        StringBuilder sb = new StringBuilder();
        if (profile.getStreetName() != null && !profile.getStreetName().isBlank()) {
            sb.append(profile.getStreetName());
        }
        if (profile.getHouseNumber() != null && !profile.getHouseNumber().isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(profile.getHouseNumber());
        }
        if (profile.getHouseNumberSuffix() != null && !profile.getHouseNumberSuffix().isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(profile.getHouseNumberSuffix());
        }
        if (profile.getPostalCode() != null && !profile.getPostalCode().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(profile.getPostalCode());
        }
        if (profile.getCity() != null && !profile.getCity().isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(profile.getCity());
        }
        if (profile.getCountry() != null && !profile.getCountry().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(profile.getCountry());
        }
        return sb.toString();
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private static String displayValue(String value) {
        return isBlank(value) ? "-" : value.trim();
    }

    private static String formatDate(LocalDate value) {
        return value == null ? "-" : value.format(DATE_FORMATTER);
    }

    private static String formatDateTime(OffsetDateTime value) {
        return value == null ? "-" : value.format(DATE_TIME_FORMATTER);
    }

    private static String formatContractType(Object value) {
        return value == null ? "-" : value.toString().toLowerCase().replace("_", " ");
    }

    private static String formatPaymentFrequency(Object value) {
        if (value == null) {
            return "-";
        }
        return switch (value.toString()) {
            case "DAILY" -> "daily";
            case "WEEKLY" -> "weekly";
            case "BIWEEKLY" -> "biweekly";
            case "MONTHLY" -> "monthly";
            default -> value.toString().toLowerCase().replace("_", " ");
        };
    }

    private static String formatPercentage(BigDecimal value) {
        return value == null ? "according to the applicable rules" : formatDecimal(value) + "%";
    }

    private static String formatDecimal(BigDecimal value) {
        return value == null ? "-" : value.stripTrailingZeros().toPlainString().replace(".", ",");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
