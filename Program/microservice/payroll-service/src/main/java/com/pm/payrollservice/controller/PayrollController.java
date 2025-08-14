// src/main/java/com/pm/payrollservice/controller/PayrollController.java
package com.pm.payrollservice.controller;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.dto.validators.CreatePayslipValidationGroup;
import com.pm.payrollservice.service.PayrollService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.groups.Default;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/payroll")
@Tag(name = "Payroll", description = "API for managing payroll service")
public class PayrollController {
    private final PayrollService payrollService;

    public PayrollController(PayrollService payrollService){
        this.payrollService = payrollService;
    }

    private static final Logger log = LoggerFactory.getLogger(PayrollController.class);

    @GetMapping
    @Operation(summary = "Get all payslips admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<List<PayslipResponseDTO>> getPayslips(){
        List<PayslipResponseDTO> payslips = payrollService.getPayslips();
        return ResponseEntity.ok().body(payslips);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a payslip by id self or admin")
    @PreAuthorize("hasAuthority('ADMIN') or @payrollPermission.isOwner(#id, authentication)")
    public ResponseEntity<PayslipResponseDTO> getPayslipById(@PathVariable UUID id){
        PayslipResponseDTO dto = payrollService.getPayslipById(id);
        return ResponseEntity.ok(dto);
    }

    @PostMapping
    @Operation(summary = "Create new payslip admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<PayslipResponseDTO> createPayslip(@Validated({Default.class, CreatePayslipValidationGroup.class}) @RequestBody PayslipRequestDTO payslipRequestDTO){
        PayslipResponseDTO payslipResponseDTO = payrollService.createPayslip(payslipRequestDTO);
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a payslip admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<PayslipResponseDTO> updatePayslip(@PathVariable UUID id, @Validated({Default.class}) @RequestBody PayslipRequestDTO payslipRequestDTO){
        PayslipResponseDTO payslipResponseDTO = payrollService.updatePayslip(id, payslipRequestDTO);
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a payslip admin only")
    @PreAuthorize("hasAuthority('ADMIN')")
    public ResponseEntity<Void> deletePayslip(@PathVariable UUID id){
        payrollService.deletePayslip(id);
        return ResponseEntity.noContent().build();
    }
}
