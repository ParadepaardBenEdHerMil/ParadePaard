package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.exception.ISOWeekPayslipAlreadyExistsException;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.validation.PayslipDuplicateValidator;
import com.pm.payrollservice.mapper.PayslipMapper;
import com.pm.payrollservice.model.Payslip;
import org.springframework.stereotype.Service;
import com.pm.payrollservice.repository.PayslipRepository;
import user.UserDataResponse;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.UUID;

@Service
public class PayrollService {
    private final PayslipRepository payslipRepository;
    private final PayslipDuplicateValidator duplicateValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;

    public PayrollService(PayslipRepository payslipRepository, PayslipDuplicateValidator duplicateValidator, UserServiceGrpcClient userServiceGrpcClient) {
        this.payslipRepository = payslipRepository;
        this.duplicateValidator = duplicateValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
    }

    public List<PayslipResponseDTO> getPayslips(){
        List<Payslip> payslips = payslipRepository.findAll();
        return payslips.stream().map(PayslipMapper::toDTO).toList();
    }

    public PayslipResponseDTO createPayslip(PayslipRequestDTO payslipRequestDTO){
        LocalDate date = LocalDate.parse(payslipRequestDTO.getDateOfIssue());
        UUID userId = UUID.fromString(payslipRequestDTO.getUserId());

        duplicateValidator.validateNoDuplicate(userId, date);

        Payslip payslip = PayslipMapper.toModel(payslipRequestDTO);
        payslip.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
        payslip.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));

        //TODO grpc request to user service -> userId -> name, address
        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        PayslipMapper.updateFromUserData(payslip, userData);

        //TODO grpc request to hour service -> userId + year + week -> hours (per event?)
        //TODO  grpc request to tax service -> userId -> tax cuts
        //TODO  grpc request to contract service -> function -> hourlyWage ?
        //TODO  calculation

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }


    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO payslipRequestDTO){
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payslip with id: " + id + " not found"));

        payslip.setUserId(UUID.fromString(payslipRequestDTO.getUserId()));
        payslip.setDateOfIssue(LocalDate.parse(payslipRequestDTO.getDateOfIssue()));
        payslip.setHoursWorked(payslipRequestDTO.getHoursWorked());
        payslip.setHourlyWage(payslipRequestDTO.getHourlyWage());

        //TODO any additional calculation logic would go here

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public void deletePayslip(UUID id){
        payslipRepository.deleteById(id);
    }

}
