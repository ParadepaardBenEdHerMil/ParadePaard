package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.PayslipRequestDTO;
import com.pm.payrollservice.dto.PayslipResponseDTO;
import com.pm.payrollservice.exception.PayslipNotFoundException;
import com.pm.payrollservice.grpc.ContractServiceGrpcClient;
import com.pm.payrollservice.grpc.TimesheetServiceGrpcClient;
import com.pm.payrollservice.grpc.UserServiceGrpcClient;
import com.pm.payrollservice.validation.PayslipValidator;
import com.pm.payrollservice.mapper.PayslipMapper;
import com.pm.payrollservice.model.Payslip;
import contract.ContractDataResponse;
import org.springframework.stereotype.Service;
import com.pm.payrollservice.repository.PayslipRepository;
import timesheet.TimesheetDataResponse;
import user.UserDataResponse;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.UUID;

@Service
public class PayrollService {
    private final PayslipRepository payslipRepository;
    private final PayslipValidator duplicateValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractServiceGrpcClient contractServiceGrpcClient;
    private final TimesheetServiceGrpcClient timesheetServiceGrpcClient;   // add

    public PayrollService(PayslipRepository payslipRepository,
                          PayslipValidator duplicateValidator,
                          UserServiceGrpcClient userServiceGrpcClient,
                          ContractServiceGrpcClient contractServiceGrpcClient,
                          TimesheetServiceGrpcClient timesheetServiceGrpcClient) {   // add
        this.payslipRepository = payslipRepository;
        this.duplicateValidator = duplicateValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractServiceGrpcClient = contractServiceGrpcClient;
        this.timesheetServiceGrpcClient = timesheetServiceGrpcClient;      // add
    }

    public List<PayslipResponseDTO> getPayslips(){
        List<Payslip> payslips = payslipRepository.findAll();
        return payslips.stream().map(PayslipMapper::toDTO).toList();
    }

    //TODO weekly/bi-weekly/monthly automation
    public PayslipResponseDTO createPayslip(PayslipRequestDTO payslipRequestDTO){
        LocalDate date = LocalDate.parse(payslipRequestDTO.getDateOfIssue());
        UUID userId = UUID.fromString(payslipRequestDTO.getUserId());

        duplicateValidator.validateNoDuplicate(userId, date);

        Payslip payslip = PayslipMapper.toModel(payslipRequestDTO);
        payslip.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
        payslip.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));

        //grpc request to user service -> userId -> name, date of birth, street name, etc.
        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        PayslipMapper.updateFromUserData(payslip, userData);

        //grpc request to contract service -> function -> start date, tax cuts, hourly wage, etc.
        ContractDataResponse contractData =  contractServiceGrpcClient.requestContractData(userId.toString());
        // grpc request to hour service -> userId + year + week -> hours worked per function, and travel expenses
        TimesheetDataResponse timesheetData = timesheetServiceGrpcClient.requestTimesheetData(userId.toString(), payslip.getWeekNumber(), payslip.getWeekBasedYear());
        PayslipMapper.updateFromContractDataAndTimesheetData(payslip, contractData, timesheetData);

        //calculation
        PayslipCalculator.apply(payslip);

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }


    public PayslipResponseDTO updatePayslip(UUID id, PayslipRequestDTO payslipRequestDTO){
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new PayslipNotFoundException("Payslip with id: " + id + " not found"));

        payslip.setUserId(UUID.fromString(payslipRequestDTO.getUserId()));
        payslip.setDateOfIssue(LocalDate.parse(payslipRequestDTO.getDateOfIssue()));

        //TODO any additional calculation logic would go here

        payslip = payslipRepository.save(payslip);
        return PayslipMapper.toDTO(payslip);
    }

    public void deletePayslip(UUID id){
        payslipRepository.deleteById(id);
    }

}
