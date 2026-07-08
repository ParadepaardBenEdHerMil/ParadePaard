// src/main/java/com/pm/contractservice/controller/ContractController.java
package com.pm.contractservice.controller;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.dto.ContractReviewRequestDTO;
import com.pm.contractservice.dto.ContractViewDTO;
import com.pm.contractservice.dto.FunctionRequestDTO;
import com.pm.contractservice.dto.FunctionResponseDTO;
import com.pm.contractservice.dto.MinimumWageResponseDTO;
import com.pm.contractservice.dto.RuleReplacementContractRequestDTO;
import com.pm.contractservice.dto.RuleReplacementContractResponseDTO;
import com.pm.contractservice.dto.SignContractRequestDTO;
import com.pm.contractservice.dto.validators.CreateContractValidationGroup;
import com.pm.contractservice.dto.validators.CreateFunctionValidationGroup;
import com.pm.contractservice.service.ContractService;
import com.pm.contractservice.service.FunctionService;
import com.pm.contractservice.service.MinimumWageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/contract")
@Tag(name = "Contract", description = "API for managing Contracts")
public class ContractController {

    private final ContractService contractService;
    private final FunctionService functionService;
    private final MinimumWageService minimumWageService;

    public ContractController(ContractService contractService, FunctionService functionService,
                              MinimumWageService minimumWageService) {
        this.contractService = contractService;
        this.functionService = functionService;
        this.minimumWageService = minimumWageService;
    }

    @GetMapping
    @Operation(summary = "Get contracts admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<List<ContractResponseDTO>> getContracts(Authentication authentication){
        List<ContractResponseDTO> contracts = contractService.getContracts(requireCompanyId(authentication));
        return ResponseEntity.ok().body(contracts);
    }

    @GetMapping("/minimum-wage")
    @Operation(summary = "Resolve the statutory Dutch minimum hourly wage for a start date and date of birth")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MinimumWageResponseDTO> getMinimumWage(
            @RequestParam String startDate,
            @RequestParam String dateOfBirth
    ) {
        LocalDate start = parseIsoDate(startDate, "startDate");
        LocalDate dob = parseIsoDate(dateOfBirth, "dateOfBirth");
        BigDecimal minimumHourlyWage = minimumWageService.minimumHourlyWage(start, dob).orElse(null);
        String effectiveFrom = minimumWageService.effectiveDate(start).map(LocalDate::toString).orElse(null);
        int age = Period.between(dob, start).getYears();
        return ResponseEntity.ok(new MinimumWageResponseDTO(startDate, dateOfBirth, age, minimumHourlyWage, effectiveFrom));
    }

    private static LocalDate parseIsoDate(String value, String field) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(field + " must be an ISO date (YYYY-MM-DD).");
        }
    }

    @GetMapping("/me")
    @Operation(summary = "Get contracts for current user")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ContractResponseDTO>> getMyContracts(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        UUID userId = UUID.fromString(authentication.getName());
        return ResponseEntity.ok(contractService.getContractsForUser(userId, requireCompanyId(authentication)));
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
                date == null || date.isBlank() ? null : java.time.LocalDate.parse(date),
                requireCompanyId(authentication)
        );
        return ResponseEntity.ok(contract);
    }

    @GetMapping("/user/{userId}")
    @Operation(summary = "Get contracts for one user admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<List<ContractResponseDTO>> getContractsForUser(@PathVariable UUID userId, Authentication authentication) {
        return ResponseEntity.ok(contractService.getContractsForUser(userId, requireCompanyId(authentication)));
    }

    @GetMapping("/user/{userId}/current")
    @Operation(summary = "Get active contract for one user admin only")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> getCurrentContractForUser(
            @PathVariable UUID userId,
            @RequestParam(required = false) String date,
            Authentication authentication
    ) {
        ContractResponseDTO contract = contractService.getCurrentContract(
                userId,
                date == null || date.isBlank() ? null : java.time.LocalDate.parse(date),
                requireCompanyId(authentication)
        );
        return ResponseEntity.ok(contract);
    }

    @PostMapping
    @Operation(summary = "Create new contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> createContract(
            @Validated({Default.class, CreateContractValidationGroup.class}) @RequestBody ContractRequestDTO contractRequestDTO,
            Authentication authentication,
            HttpServletRequest httpRequest
    ){
        ContractResponseDTO contractResponseDTO = contractService.createContract(
                contractRequestDTO,
                requireCompanyId(authentication),
                bearerToken(httpRequest)
        );
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @PostMapping("/rule-replacement")
    @Operation(summary = "Create a forward replacement draft contract from a published rule change")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<RuleReplacementContractResponseDTO> createRuleReplacementDraft(
            @RequestBody RuleReplacementContractRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(contractService.createRuleReplacementDraft(
                request,
                requireCompanyId(authentication),
                bearerToken(httpRequest)
        ));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> updateContract(
            @PathVariable UUID id,
            @Validated({Default.class}) @RequestBody ContractRequestDTO contractRequestDTO,
            Authentication authentication,
            HttpServletRequest httpRequest
    ){
        ContractResponseDTO contractResponseDTO = contractService.updateContract(
                id,
                contractRequestDTO,
                requireCompanyId(authentication),
                bearerToken(httpRequest)
        );
        return ResponseEntity.ok().body(contractResponseDTO);
    }

    @GetMapping("/{id}/view")
    @Operation(summary = "Get contract view with user data")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS')")
    public ResponseEntity<ContractViewDTO> getContractView(@PathVariable UUID id, Authentication authentication) {
        ContractViewDTO contractViewDTO = contractService.getContractView(id, requireCompanyId(authentication));
        return ResponseEntity.ok().body(contractViewDTO);
    }

    @GetMapping("/{id}/pdf")
    @Operation(summary = "Download contract PDF")
    @PreAuthorize("hasAuthority('CAN_VIEW_ALL_CONTRACTS') or @contractPermission.isOwner(#id, authentication)")
    public ResponseEntity<byte[]> downloadContractPdf(@PathVariable UUID id, Authentication authentication) {
        byte[] pdf = contractService.getContractPdf(id, requireCompanyId(authentication));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"contract-" + id + ".pdf\"")
                .body(pdf);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete contract admin only")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<Void> deleteContract(@PathVariable UUID id, Authentication authentication, HttpServletRequest httpRequest) {
        contractService.deleteContract(id, requireCompanyId(authentication), bearerToken(httpRequest));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/finalize")
    @Operation(summary = "Finalize contract for current user")
    @PreAuthorize("hasAuthority('CAN_FINALIZE_CONTRACT')")
    public ResponseEntity<ContractResponseDTO> finalizeContract(Authentication authentication, HttpServletRequest httpRequest) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        UUID userId = UUID.fromString(authentication.getName());
        ContractResponseDTO response = contractService.finalizeContract(userId, bearerToken(httpRequest));
        return ResponseEntity.ok().body(response);
    }

    @PostMapping("/{id}/send")
    @Operation(summary = "Send contract to employee")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> sendContract(
            @PathVariable UUID id,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(contractService.sendContract(id, requireCompanyId(authentication), bearerToken(httpRequest)));
    }

    @PostMapping("/{id}/employer-signature")
    @Operation(summary = "Store employer pre-signature on contract")
    @PreAuthorize("hasAuthority('CAN_MANAGE_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> prepareEmployerSignature(
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
        return ResponseEntity.ok(contractService.prepareEmployerSignature(
                id,
                managerUserId,
                requireCompanyId(authentication),
                signature,
                bearerToken(httpRequest)
        ));
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
        return ResponseEntity.ok(contractService.signContract(id, userId, signature, bearerToken(httpRequest)));
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
        return ResponseEntity.ok(contractService.finalizeContractById(
                id,
                managerUserId,
                requireCompanyId(authentication),
                signature,
                bearerToken(httpRequest)
        ));
    }

    @PostMapping("/{id}/reject")
    @Operation(summary = "Reject signed contract")
    @PreAuthorize("hasAuthority('CAN_REVIEW_CONTRACTS')")
    public ResponseEntity<ContractResponseDTO> rejectContract(
            @PathVariable UUID id,
            @RequestBody ContractReviewRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        return ResponseEntity.ok(contractService.rejectContract(
                id,
                requireCompanyId(authentication),
                request.getComment(),
                bearerToken(httpRequest)
        ));
    }

    private static UUID requireCompanyId(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwtAuthenticationToken) {
            String claim = jwtAuthenticationToken.getToken().getClaimAsString("companyId");
            if (claim != null && !claim.isBlank()) {
                return UUID.fromString(claim.trim());
            }
        }
        return null;
    }

    private static String bearerToken(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            return null;
        }
        if (authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authorization.substring(7).trim();
        }
        return null;
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
