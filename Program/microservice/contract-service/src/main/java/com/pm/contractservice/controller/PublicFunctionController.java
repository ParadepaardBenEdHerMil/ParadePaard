package com.pm.contractservice.controller;

import com.pm.contractservice.dto.PublicJobFunctionDTO;
import com.pm.contractservice.service.FunctionService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Anonymous, read-only job-function lookup for the public job-application form. Lives under
 * {@code /public/**}, which SecurityConfig permits without auth (and the gateway routes without
 * JwtValidation). Only active functions and only their id + name are exposed — no wages.
 */
@RestController
@RequestMapping("/public")
public class PublicFunctionController {

    private final FunctionService functionService;

    public PublicFunctionController(FunctionService functionService) {
        this.functionService = functionService;
    }

    @GetMapping("/functions")
    @Operation(summary = "List active job functions (public, application form)")
    public ResponseEntity<List<PublicJobFunctionDTO>> getPublicFunctions() {
        return ResponseEntity.ok(functionService.getActivePublicFunctions());
    }
}
