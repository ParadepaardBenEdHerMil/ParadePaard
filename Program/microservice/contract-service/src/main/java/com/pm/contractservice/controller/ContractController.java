// src/main/java/com/pm/contractservice/controller/ContractController.java
package com.pm.contractservice.controller;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.dto.ContractReviewRequestDTO;
import com.pm.contractservice.dto.ContractViewDTO;
import com.pm.contractservice.dto.FunctionRequestDTO;
import com.pm.contractservice.dto.FunctionResponseDTO;
import com.pm.contractservice.dto.SignContractRequestDTO;
import com.pm.contractservice.dto.validators.CreateContractValidationGroup;
import com.pm.contractservice.dto.validators.CreateFunctionValidationGroup;
import com.pm.contractservice.service.ContractService;
import com.pm.contractservice.service.FunctionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<List<ContractResponseDTO>> getContracts(){
        List<ContractResponseDTO> contracts = contractService.getContracts();
        return ResponseEntity.ok().body(contracts);
    }

    @GetMapping("/me")
    @Operation(summary = "Get contracts for current user")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ContractResponseDTO>> getMyContracts(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(contractService.getContractsForUser(userId));
    }

    @GetMapping("/me/current")
    @Operation(summary = "Get active contract for current user")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ContractResponseDTO> getMyCurrentContract(
            Authentication authentication,
            @RequestParam(required = false) String date
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        UUID userId = UUID.fromString(authentication.getName());
        ContractResponseDTO contract = contractService.getCurrentContract(
                userId,
                date == null || date.isBlank() ? null : java.time.LocalDate.parse(date)
        );
        return ResponseEntity.ok(contract);
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get contracts for one user admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<List<ContractResponseDTO>> getContractsForUser(@PathVariable UUID userId) {
        return ResponseEntity.ok(contractService.getContractsForUser(userId));
    }

    @GetMapping("/user/{userId}/current")
    @Operation(summary = "Get active contract for one user admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> getCurrentContractForUser(
            @PathVariable UUID userId,
            @RequestParam(required = false) String date
    ) {
        ContractResponseDTO contract = contractService.getCurrentContract(
                userId,
                date == null || date.isBlank() ? null : java.time.LocalDate.parse(date)
        );
        return ResponseEntity.ok(contract);
    }

    @PostMapping
    @Operation(summary = "Create new contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> createContract(@Validated({Default.class, CreateContractValidationGroup.class}) @RequestBody ContractRequestDTO contractRequestDTO){
        ContractResponseDTO contractResponseDTO = contractService.createContract(contractRequestDTO);
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> updateContract(@PathVariable UUID id, @Validated({Default.class}) @RequestBody ContractRequestDTO contractRequestDTO){
        ContractResponseDTO contractResponseDTO = contractService.updateContract(id, contractRequestDTO);
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @GetMapping("/{id}/view")
    @Operation(summary = "Get contract view with user data")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<ContractViewDTO> getContractView(@PathVariable UUID id) {
        ContractViewDTO contractViewDTO = contractService.getContractView(id);
        return ResponseEntity.ok().body(contractViewDTO);
    }

    @GetMapping("/{id}/pdf")
    @Operation(summary = "Download contract PDF")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS') or @contractPermission.isOwner(#id, authentication)")
    public ResponseEntity<byte[]> downloadContractPdf(@PathVariable UUID id) {
        byte[] pdf = contractService.getContractPdf(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contract-" + id + ".pdf\"")
                .body(pdf);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<Void> deleteContract(@PathVariable UUID id) {
        contractService.deleteContract(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/finalize")
    @Operation(summary = "Finalize contract for current user")
    @PreAuthorize("hasAuthority('CAN_FINALIZE_CONTRACT')")
    public ResponseEntity<ContractResponseDTO> finalizeContract(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        UUID userId = UUID.fromString(authentication.getName());
        ContractResponseDTO response = contractService.finalizeContract(userId);
        return ResponseEntity.ok().body(response);
    }

    @PostMapping("/{id}/send")
    @Operation(summary = "Send contract to employee")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> sendContract(@PathVariable UUID id) {
        return ResponseEntity.ok(contractService.sendContract(id));
    }

    @PostMapping("/{id}/sign")
    @Operation(summary = "Sign own contract")
    @PreAuthorize("@contractPermission.isOwner(#id, authentication)")
    public ResponseEntity<ContractResponseDTO> signContract(
            @PathVariable UUID id,
            @RequestBody(required = false) SignContractRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        UUID userId = UUID.fromString(authentication.getName());
        SignContractRequestDTO signature = request == null ? new SignContractRequestDTO() : request;
        if (signature.getIpAddress() == null || signature.getIpAddress().isBlank()) {
            signature.setIpAddress(clientIp(httpRequest));
        }
        if (signature.getBrowserUserAgent() == null || signature.getBrowserUserAgent().isBlank()) {
            signature.setBrowserUserAgent(httpRequest.getHeader("User-Agent"));
        }
        return ResponseEntity.ok(contractService.signContract(id, userId, signature));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/{id}/finalize")
    @Operation(summary = "Finalize signed contract")
    @PreAuthorize("hasAuthority('CAN_FINALIZE_CONTRACT')")
    public ResponseEntity<ContractResponseDTO> finalizeContractById(
            @PathVariable UUID id,
            @RequestBody(required = false) SignContractRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        UUID managerUserId = authentication == null || authentication.getName() == null
                ? null
                : UUID.fromString(authentication.getName());
        SignContractRequestDTO signature = request == null ? new SignContractRequestDTO() : request;
        if (signature.getIpAddress() == null || signature.getIpAddress().isBlank()) {
            signature.setIpAddress(clientIp(httpRequest));
        }
        if (signature.getBrowserUserAgent() == null || signature.getBrowserUserAgent().isBlank()) {
            signature.setBrowserUserAgent(httpRequest.getHeader("User-Agent"));
        }
        return ResponseEntity.ok(contractService.finalizeContractById(id, managerUserId, signature));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject signed contract")
    @PreAuthorize("hasAuthority('CAN_REVIEW_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> rejectContract(
            @PathVariable UUID id,
            @RequestBody ContractReviewRequestDTO request
    ) {
        return ResponseEntity.ok(contractService.rejectContract(id, request.getComment()));
    }

    @GetMapping("/function")
    @Operation(summary = "Get functions admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_FUNCTIONS')")
    public ResponseEntity<List<FunctionResponseDTO>> getFunctions(){
        List<FunctionResponseDTO> functions = functionService.getFunctions();
        return ResponseEntity.ok().body(functions);
    }

    @PostMapping("/function")
    @Operation(summary = "Create new function admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_FUNCTIONS')")
    public ResponseEntity<FunctionResponseDTO> createFunction(@Validated({Default.class, CreateFunctionValidationGroup.class}) @RequestBody FunctionRequestDTO functionRequestDTO){
        FunctionResponseDTO functionResponseDTO = functionService.createFunction(functionRequestDTO);
        return ResponseEntity.ok().body(functionResponseDTO);
    }

    @PutMapping("/function/{id}")
    @Operation(summary = "Update function admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_FUNCTIONS')")
    public ResponseEntity<FunctionResponseDTO> updateFunction(@PathVariable UUID id, @Validated({Default.class}) @RequestBody FunctionRequestDTO functionRequestDTO){
        FunctionResponseDTO functionResponseDTO = functionService.updateFunction(id, functionRequestDTO);
        return ResponseEntity.ok().body(functionResponseDTO);
    }

    @DeleteMapping("/function/{id}")
    @Operation(summary = "Delete function admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_FUNCTIONS')")
    public ResponseEntity<Void> deleteFunction(@PathVariable UUID id) {
        functionService.deleteFunction(id);
        return ResponseEntity.noContent().build();
    }
}
