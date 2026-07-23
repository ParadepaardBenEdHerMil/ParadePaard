package com.pm.contractservice.service;

import com.pm.contractservice.dto.FunctionRequestDTO;
import com.pm.contractservice.dto.FunctionResponseDTO;
import com.pm.contractservice.dto.PublicJobFunctionDTO;
import com.pm.contractservice.exception.FunctionNotFoundException;
import com.pm.contractservice.mapper.FunctionMapper;
import com.pm.contractservice.model.Function;
import com.pm.contractservice.repository.FunctionRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class FunctionService {
    private final FunctionRepository functionRepository;

    public FunctionService(FunctionRepository functionRepository) {
        this.functionRepository = functionRepository;
    }

    public List<FunctionResponseDTO> getFunctions(){
        List<Function> function = functionRepository.findAll();
        return function.stream().map(FunctionMapper::toDTO).toList();
    }

    /** Active functions as id + name only, for the anonymous application-form picker. */
    public List<PublicJobFunctionDTO> getActivePublicFunctions(){
        return functionRepository.findByActiveTrueOrderByFunctionNameAsc().stream()
                .map(function -> new PublicJobFunctionDTO(function.getFunctionId(), function.getFunctionName()))
                .toList();
    }

    public FunctionResponseDTO createFunction(FunctionRequestDTO functionRequestDTO){
        Function function = FunctionMapper.toModel(functionRequestDTO);
        function = functionRepository.save(function);
        return FunctionMapper.toDTO(function);
    }

    public FunctionResponseDTO updateFunction(UUID id, FunctionRequestDTO functionRequestDTO){
        Function function = functionRepository.findById(id)
                .orElseThrow(() -> new FunctionNotFoundException("Function with id: " + id + " not found"));

        function.setFunctionName(functionRequestDTO.getFunctionName());
        function.setDepartment(functionRequestDTO.getDepartment());
        function.setHourlyWage(functionRequestDTO.getHourlyWage());
        function.setActive(functionRequestDTO.getActive() == null || functionRequestDTO.getActive());

        function = functionRepository.save(function);
        return FunctionMapper.toDTO(function);
    }

    public void deleteFunction(UUID id){
        if (!functionRepository.existsById(id)) {
            throw new FunctionNotFoundException("Function with id: " + id + " not found");
        }
        functionRepository.deleteById(id);
    }
}
