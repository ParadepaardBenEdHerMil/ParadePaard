package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.mapper.PayslipMapper;
import com.pm.payrollservice.model.Payslip;
import org.springframework.stereotype.Service;
import com.pm.payrollservice.repository.PayslipRepository;

import java.util.List;

@Service
public class PayslipService {
    private final PayslipRepository payslipRepository;

    public PayslipService(PayslipRepository payslipRepository){
        this.payslipRepository = payslipRepository;
    }

    public List<PayslipResponseDTO> getPayslips(){
        List<Payslip> payslips = payslipRepository.findAll();
        return payslips.stream().map(PayslipMapper::toDTO).toList();
    }
}
