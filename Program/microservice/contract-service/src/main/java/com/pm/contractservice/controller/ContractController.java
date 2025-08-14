// src/main/java/com/pm/contractservice/controller/ContractController.java
package com.pm.contractservice.controller;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.dto.FunctionRequestDTO;
import com.pm.contractservice.dto.FunctionResponseDTO;
import com.pm.contractservice.dto.validators.CreateContractValidationGroup;
import com.pm.contractservice.dto.validators.CreateFunctionValidationGroup;
import com.pm.contractservice.service.ContractService;
import com.pm.contractservice.service.FunctionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/contract")
@Tag(name = "Contract", description = "API for managing Contracts")
public class ContractController {

    private final ContractService contractService;
    private final FunctionService functionService;

    public ContractController(ContractService contractService, FunctionService functionService) {
        this.contractService = contractService;
        this.functionService = functionService;
    }

    @GetMapping
    @Operation(summary = "Get contracts admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<ContractResponseDTO>> getContracts(){
        List<ContractResponseDTO> contracts = contractService.getContracts();
        return ResponseEntity.ok().body(contracts);
    }

    @PostMapping
    @Operation(summary = "Create new contract admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ContractResponseDTO> createContract(@Validated({Default.class, CreateContractValidationGroup.class}) @RequestBody ContractRequestDTO contractRequestDTO){
        ContractResponseDTO contractResponseDTO = contractService.createContract(contractRequestDTO);
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update contract admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<ContractResponseDTO> updateContract(@PathVariable UUID id, @Validated({Default.class}) @RequestBody ContractRequestDTO contractRequestDTO){
        ContractResponseDTO contractResponseDTO = contractService.updateContract(id, contractRequestDTO);
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete contract admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> deleteContract(@PathVariable UUID id) {
        contractService.deleteContract(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/function")
    @Operation(summary = "Get functions admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<FunctionResponseDTO>> getFunctions(){
        List<FunctionResponseDTO> functions = functionService.getFunctions();
        return ResponseEntity.ok().body(functions);
    }

    @PostMapping("/function")
    @Operation(summary = "Create new function admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<FunctionResponseDTO> createFunction(@Validated({Default.class, CreateFunctionValidationGroup.class}) @RequestBody FunctionRequestDTO functionRequestDTO){
        FunctionResponseDTO functionResponseDTO = functionService.createFunction(functionRequestDTO);
        return ResponseEntity.ok().body(functionResponseDTO);
    }

    @PutMapping("/function/{id}")
    @Operation(summary = "Update function admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<FunctionResponseDTO> updateFunction(@PathVariable UUID id, @Validated({Default.class}) @RequestBody FunctionRequestDTO functionRequestDTO){
        FunctionResponseDTO functionResponseDTO = functionService.updateFunction(id, functionRequestDTO);
        return ResponseEntity.ok().body(functionResponseDTO);
    }

    @DeleteMapping("/function/{id}")
    @Operation(summary = "Delete function admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> deleteFunction(@PathVariable UUID id) {
        functionService.deleteFunction(id);
        return ResponseEntity.noContent().build();
    }
}
