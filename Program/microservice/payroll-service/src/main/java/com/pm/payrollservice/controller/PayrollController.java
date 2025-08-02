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
    @Operation(summary = "Get Payslips")
    public ResponseEntity<List<PayslipResponseDTO>> getPayslips(){
        List<PayslipResponseDTO> payslips = payrollService.getPayslips();
        return ResponseEntity.ok().body(payslips);
    }

    @PostMapping
    @Operation(summary = "Create new Payslip")
    public ResponseEntity<PayslipResponseDTO> createPayslip(@Validated({Default.class, CreatePayslipValidationGroup.class}) @RequestBody PayslipRequestDTO payslipRequestDTO){
        PayslipResponseDTO payslipResponseDTO = payrollService.createPayslip(payslipRequestDTO);
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a Payslip")
    public ResponseEntity<PayslipResponseDTO> updatePayslip(@PathVariable UUID id, @Validated({Default.class}) @RequestBody PayslipRequestDTO payslipRequestDTO){
        PayslipResponseDTO payslipResponseDTO = payrollService.updatePayslip(id, payslipRequestDTO);
        return ResponseEntity.ok().body(payslipResponseDTO);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a Payslip")
    public ResponseEntity<PayslipResponseDTO> deletePayslip(@PathVariable UUID id){
        payrollService.deletePayslip(id);
        return ResponseEntity.noContent().build();
    }

}
