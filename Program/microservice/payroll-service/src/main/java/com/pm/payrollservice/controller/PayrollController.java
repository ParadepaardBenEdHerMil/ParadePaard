package com.pm.payrollservice.controller;

import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.service.PayslipService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/payroll")
@Tag(name = "Payroll", description = "API for managing payroll service")
public class PayrollController {
    private final PayslipService payslipService;

    public PayrollController(PayslipService payslipService){
        this.payslipService = payslipService;
    }

    private static final Logger log = LoggerFactory.getLogger(PayrollController.class);

    @GetMapping
    @Operation(summary = "Get Payslips test")
    public ResponseEntity<List<PayslipResponseDTO>> getPayslips(){
        List<PayslipResponseDTO> payslips = payslipService.getPayslips();
        return ResponseEntity.ok().body(payslips);
    }
}
