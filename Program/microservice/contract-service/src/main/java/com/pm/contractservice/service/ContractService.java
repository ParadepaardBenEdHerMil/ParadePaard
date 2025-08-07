package com.pm.contractservice.service;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.exception.ContractNotFoundException;
import com.pm.contractservice.mapper.ContractMapper;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.repository.ContractRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class ContractService {
    private final ContractRepository contractRepository;

    public ContractService(ContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    public List<ContractResponseDTO> getContracts(){
        List<Contract> contracts = contractRepository.findAll();
        return contracts.stream().map(ContractMapper::toDTO).toList();
    }

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO){
        Contract contract = ContractMapper.toModel(contractRequestDTO);
        contract = contractRepository.save(contract);
        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO){
        Contract contract = contractRepository.findById(id)
                .orElseThrow(() -> new ContractNotFoundException("Contract with id: " + id + " not found"));

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        contract.setEndDate(LocalDate.parse(contractRequestDTO.getEndDate()));
        contract.setWageTaxAmountTest(contractRequestDTO.getWageTaxAmountTest());

        contract = contractRepository.save(contract);
        return ContractMapper.toDTO(contract);
    }

    public void deleteContract(UUID id){
        if (!contractRepository.existsById(id)) {
            throw new ContractNotFoundException("Contract with id: " + id + " not found");
        }
        contractRepository.deleteById(id);
    }

}
