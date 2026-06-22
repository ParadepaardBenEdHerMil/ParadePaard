package com.pm.payrollservice.dto;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class PayslipDeductionCodec {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<PayrollDeductionLineDTO>> DEDUCTION_LIST_TYPE = new TypeReference<>() {};

    private PayslipDeductionCodec() {}

    public static List<PayrollDeductionLineDTO> read(String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<PayrollDeductionLineDTO> lines = OBJECT_MAPPER.readValue(rawJson, DEDUCTION_LIST_TYPE);
            return normalize(lines);
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    public static String write(List<PayrollDeductionLineDTO> lines) {
        try {
            return OBJECT_MAPPER.writeValueAsString(normalize(lines));
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Could not store deduction lines");
        }
    }

    public static List<PayrollDeductionLineDTO> normalize(List<PayrollDeductionLineDTO> lines) {
        List<PayrollDeductionLineDTO> normalized = new ArrayList<>();
        if (lines == null) {
            return normalized;
        }

        for (PayrollDeductionLineDTO line : lines) {
            if (line == null) continue;

            PayrollDeductionLineDTO normalizedLine = new PayrollDeductionLineDTO();
            normalizedLine.setId(
                    line.getId() == null || line.getId().isBlank() ? UUID.randomUUID().toString() : line.getId().trim()
            );
            normalizedLine.setCode(trimUpper(line.getCode()));
            normalizedLine.setLabel(trim(line.getLabel()));
            normalizedLine.setCategory(trimUpper(line.getCategory()));
            normalizedLine.setCalculationType(normalizeCalculationType(line.getCalculationType()));
            normalizedLine.setConfiguredValue(line.getConfiguredValue());
            normalizedLine.setCalculatedAmount(line.getCalculatedAmount());
            normalizedLine.setManualAmountOverride(line.getManualAmountOverride());
            normalizedLine.setSource(trimUpper(line.getSource()));
            normalizedLine.setNotes(trim(line.getNotes()));
            normalizedLine.setSortOrder(line.getSortOrder() == null ? 0 : line.getSortOrder());

            if (normalizedLine.getCode().isEmpty() && normalizedLine.getLabel().isEmpty()) {
                continue;
            }

            normalized.add(normalizedLine);
        }

        normalized.sort(Comparator
                .comparing((PayrollDeductionLineDTO line) -> line.getSortOrder() == null ? 0 : line.getSortOrder())
                .thenComparing(line -> trimUpper(line.getCode()))
                .thenComparing(line -> trim(line.getLabel())));
        return normalized;
    }

    public static PayrollDeductionLineDTO createLegacyLoonheffingLine(BigDecimal amount) {
        PayrollDeductionLineDTO line = new PayrollDeductionLineDTO();
        line.setId(UUID.randomUUID().toString());
        line.setCode("LOONHEFFING");
        line.setLabel("Loonheffing");
        line.setCategory("TAX");
        line.setCalculationType("FIXED_AMOUNT");
        line.setConfiguredValue(amount);
        line.setCalculatedAmount(amount);
        line.setManualAmountOverride(amount);
        line.setSource("MANUAL");
        line.setNotes("Legacy single tax amount");
        line.setSortOrder(10);
        return line;
    }

    private static String normalizeCalculationType(String value) {
        String normalized = trimUpper(value);
        return switch (normalized) {
            case "PERCENT_OF_GROSS", "LOONHEFFING_TABLE" -> normalized;
            default -> "FIXED_AMOUNT";
        };
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimUpper(String value) {
        return trim(value).toUpperCase(Locale.ROOT);
    }
}
