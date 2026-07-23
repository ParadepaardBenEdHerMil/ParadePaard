package com.pm.contractservice.mapper;

import com.pm.contractservice.dto.FunctionRequestDTO;
import com.pm.contractservice.dto.FunctionResponseDTO;
import com.pm.contractservice.model.Function;

public class FunctionMapper {
    public static FunctionResponseDTO toDTO(Function function){
        FunctionResponseDTO functionResponseDTO = new FunctionResponseDTO();
        functionResponseDTO.setFunctionId(function.getFunctionId());

        functionResponseDTO.setFunctionName(function.getFunctionName());
        functionResponseDTO.setDepartment(function.getDepartment());
        functionResponseDTO.setActive(function.getActive());

        return functionResponseDTO;
    }

    public static Function toModel(FunctionRequestDTO functionRequestDTODTODTO){
        Function function = new Function();

        function.setFunctionName(functionRequestDTODTODTO.getFunctionName());
        function.setDepartment(functionRequestDTODTODTO.getDepartment());
        function.setActive(functionRequestDTODTODTO.getActive() == null || functionRequestDTODTODTO.getActive());

        return function;
    }


}
