package com.pm.contractservice.mapper;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.model.Contract;

import java.time.LocalDate;
import java.util.UUID;

public class ContractMapper {
    public static ContractResponseDTO toDTO(Contract contract){
        ContractResponseDTO contractResponseDTO = new ContractResponseDTO();
        contractResponseDTO.setContractId(contract.getContractId());
        contractResponseDTO.setUserId(contract.getUserId());

        contractResponseDTO.setStartDate(contract.getStartDate());
        contractResponseDTO.setEndDate(contract.getEndDate());
        contractResponseDTO.setWageTaxAmountTest(contract.getWageTaxAmountTest());
        contractResponseDTO.setFunctions(contract.getFunctions());

        return contractResponseDTO;
    }

    public static Contract toModel(ContractRequestDTO contractRequestDTO){
        Contract contract = new Contract();

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        contract.setEndDate(LocalDate.parse(contractRequestDTO.getEndDate()));
        contract.setWageTaxAmountTest(contractRequestDTO.getWageTaxAmountTest());

        return contract;
    }
}
