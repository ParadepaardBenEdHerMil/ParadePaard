package com.pm.contractservice.service;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.mapper.ContractMapper;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.Function;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.validation.ContractValidator;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ContractService {

    private final ContractRepository contractRepository;
    private final ContractValidator contractValidator;

    public ContractService(ContractRepository contractRepository,
                           ContractValidator contractValidator) {
        this.contractRepository = contractRepository;
        this.contractValidator = contractValidator;
    }

    public List<ContractResponseDTO> getContracts() {
        return contractRepository.findAll()
                .stream()
                .map(ContractMapper::toDTO)
                .toList();
    }

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO) {
        contractValidator.ensureNoContractForUser(UUID.fromString(contractRequestDTO.getUserId()));
        // take the function name from the request look up the corresponding Function entity, and set it in the contract function list
        List<Function> functions = contractValidator.ensureFunctionsExist(contractRequestDTO.getFunctions());

        Contract contract = ContractMapper.toModel(contractRequestDTO);
        contract.setFunctions(functions); // Set the functions in the contract
        contract = contractRepository.save(contract);
        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO) {
        Contract contract = contractValidator.getExistingContract(id);
        contractValidator.ensureFunctionsExist(contractRequestDTO.getFunctions());
        List<Function> functions = contractValidator.ensureFunctionsExist(contractRequestDTO.getFunctions());

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        contract.setEndDate(LocalDate.parse(contractRequestDTO.getEndDate()));
        contract.setWageTaxAmountTest(contractRequestDTO.getWageTaxAmountTest());
        contract.setFunctions(functions);

        contract = contractRepository.save(contract);
        return ContractMapper.toDTO(contract);
    }

    public void deleteContract(UUID id) {
        contractValidator.getExistingContract(id);
        contractRepository.deleteById(id);
    }
}