package com.pm.contractservice.validation;

import com.pm.contractservice.exception.ContractAlreadyExistsException;
import com.pm.contractservice.exception.ContractNotFoundException;
import com.pm.contractservice.exception.FunctionNotFoundException;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.Function;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.repository.FunctionRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class ContractValidator {

    private final ContractRepository contractRepository;
    private final FunctionRepository functionRepository;

    public ContractValidator(ContractRepository contractRepository,
                             FunctionRepository functionRepository) {
        this.contractRepository = contractRepository;
        this.functionRepository = functionRepository;
    }

    public void ensureNoContractForUser(UUID userId) {
        if (contractRepository.existsByUserId(userId)) {
            throw new ContractAlreadyExistsException(
                    "A contract for user with id " + userId + " already exists");
        }
    }

    public Contract getExistingContract(UUID contractId) {
        return contractRepository.findById(contractId)
                .orElseThrow(() ->
                        new ContractNotFoundException(
                                "Contract with id " + contractId + " not found"));
    }

    public List<Function> ensureFunctionsExist(List<String> functions) {
        List<Function> functionsList = new ArrayList<>();

        for (String name : functions) {
            if (!functionRepository.existsByFunctionName(name)) {
                throw new FunctionNotFoundException(name);
            }
            functionsList.add(functionRepository.findByFunctionName(name));
        }
        return functionsList;
    }
}