package com.pm.contractservice.mapper;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;

import java.time.LocalDate;
import java.util.UUID;

public class ContractMapper {
    public static ContractResponseDTO toDTO(Contract contract){
        ContractResponseDTO contractResponseDTO = new ContractResponseDTO();
        contractResponseDTO.setContractId(contract.getContractId());
        contractResponseDTO.setUserId(contract.getUserId());
        contractResponseDTO.setFunctionId(contract.getFunctionId());
        contractResponseDTO.setFunctionName(contract.getFunctionName());

        contractResponseDTO.setStartDate(contract.getStartDate());
        contractResponseDTO.setEndDate(contract.getEndDate());
        contractResponseDTO.setContractType(contract.getContractType());
        contractResponseDTO.setStatus(contract.getStatus());
        contractResponseDTO.setGrossHourlyWage(contract.getGrossHourlyWage());
        contractResponseDTO.setTravelAllowance(contract.getTravelAllowance());
        contractResponseDTO.setPaymentFrequency(contract.getPaymentFrequency() == null ? null : contract.getPaymentFrequency().name());
        contractResponseDTO.setWeeklyHours(contract.getWeeklyHours());
        contractResponseDTO.setHolidayAllowancePercentage(contract.getHolidayAllowancePercentage());
        contractResponseDTO.setLeaveEntitlementDays(contract.getLeaveEntitlementDays());
        contractResponseDTO.setWorkLocation(contract.getWorkLocation());
        contractResponseDTO.setProbationPeriod(contract.getProbationPeriod());
        contractResponseDTO.setNoticePeriod(contract.getNoticePeriod());
        contractResponseDTO.setCollectiveAgreement(contract.getCollectiveAgreement());
        contractResponseDTO.setPensionScheme(contract.getPensionScheme());
        contractResponseDTO.setSicknessPolicy(contract.getSicknessPolicy());
        contractResponseDTO.setConfidentialityClause(contract.getConfidentialityClause());
        contractResponseDTO.setReviewComment(contract.getReviewComment());
        contractResponseDTO.setSentToEmployeeAt(asString(contract.getSentToEmployeeAt()));
        contractResponseDTO.setEmployeeSignedAt(asString(contract.getEmployeeSignedAt()));
        contractResponseDTO.setFinalizedAt(asString(contract.getFinalizedAt()));
        contractResponseDTO.setRejectedAt(asString(contract.getRejectedAt()));
        contractResponseDTO.setSignedUserId(contract.getSignedUserId());
        contractResponseDTO.setTypedSignatureName(contract.getTypedSignatureName());
        contractResponseDTO.setDrawnSignatureImage(contract.getDrawnSignatureImage());
        contractResponseDTO.setAgreementCheckboxText(contract.getAgreementCheckboxText());
        contractResponseDTO.setContractVersion(contract.getContractVersion());
        contractResponseDTO.setDocumentHash(contract.getDocumentHash());
        contractResponseDTO.setIpAddress(contract.getIpAddress());
        contractResponseDTO.setBrowserUserAgent(contract.getBrowserUserAgent());
        contractResponseDTO.setEmployerSignedUserId(contract.getEmployerSignedUserId());
        contractResponseDTO.setEmployerTypedSignatureName(contract.getEmployerTypedSignatureName());
        contractResponseDTO.setEmployerDrawnSignatureImage(contract.getEmployerDrawnSignatureImage());
        contractResponseDTO.setEmployerAgreementCheckboxText(contract.getEmployerAgreementCheckboxText());
        contractResponseDTO.setEmployerContractVersion(contract.getEmployerContractVersion());
        contractResponseDTO.setEmployerDocumentHash(contract.getEmployerDocumentHash());
        contractResponseDTO.setEmployerIpAddress(contract.getEmployerIpAddress());
        contractResponseDTO.setEmployerBrowserUserAgent(contract.getEmployerBrowserUserAgent());

        return contractResponseDTO;
    }

    public static Contract toModel(ContractRequestDTO contractRequestDTO){
        Contract contract = new Contract();

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        if (contractRequestDTO.getFunctionId() != null && !contractRequestDTO.getFunctionId().isBlank()) {
            contract.setFunctionId(UUID.fromString(contractRequestDTO.getFunctionId()));
        }
        contract.setFunctionName(contractRequestDTO.getFunctionName());
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        if (contractRequestDTO.getEndDate() != null && !contractRequestDTO.getEndDate().isBlank()) {
            contract.setEndDate(LocalDate.parse(contractRequestDTO.getEndDate()));
        }
        contract.setContractType(ContractType.valueOf(contractRequestDTO.getContractType()));
        contract.setGrossHourlyWage(contractRequestDTO.getGrossHourlyWage());
        contract.setTravelAllowance(contractRequestDTO.getTravelAllowance());
        contract.setPaymentFrequency(PaymentFrequency.fromNullable(contractRequestDTO.getPaymentFrequency()));
        contract.setWeeklyHours(contractRequestDTO.getWeeklyHours());
        contract.setHolidayAllowancePercentage(contractRequestDTO.getHolidayAllowancePercentage());
        contract.setLeaveEntitlementDays(contractRequestDTO.getLeaveEntitlementDays());
        contract.setWorkLocation(contractRequestDTO.getWorkLocation());
        contract.setProbationPeriod(contractRequestDTO.getProbationPeriod());
        contract.setNoticePeriod(contractRequestDTO.getNoticePeriod());
        contract.setCollectiveAgreement(contractRequestDTO.getCollectiveAgreement());
        contract.setPensionScheme(contractRequestDTO.getPensionScheme());
        contract.setSicknessPolicy(contractRequestDTO.getSicknessPolicy());
        contract.setConfidentialityClause(contractRequestDTO.getConfidentialityClause());

        return contract;
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }
}
