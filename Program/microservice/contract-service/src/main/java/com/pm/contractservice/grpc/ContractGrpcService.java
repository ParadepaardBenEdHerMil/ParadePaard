package com.pm.contractservice.grpc;

import com.pm.contractservice.exception.ContractNotFoundException;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.repository.ContractRepository;
import contract.ContractDataRequest;
import contract.ContractDataResponse;
import contract.ContractServiceGrpc;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

@GrpcService
public class ContractGrpcService extends ContractServiceGrpc.ContractServiceImplBase {

    private final ContractRepository contractRepository;

    public ContractGrpcService(ContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public void requestContractData(ContractDataRequest request, StreamObserver<ContractDataResponse> responseObserver) {
        try {
            UUID userId = UUID.fromString(request.getUserId());
            LocalDate periodStart = parseOrDefault(request.getPeriodStart(), LocalDate.now());
            LocalDate periodEnd = parseOrDefault(request.getPeriodEnd(), periodStart);

            Contract contract = contractRepository.findPayrollActiveForPeriod(userId, periodStart, periodEnd)
                    .stream()
                    .findFirst()
                    .orElseThrow(() -> new ContractNotFoundException(
                            "Payroll-active contract for " + userId + " not found between " + periodStart + " and " + periodEnd));


            ContractDataResponse response = ContractDataResponse.newBuilder()
                    .setStartDate(contract.getStartDate().toString())
                    .setEndDate(contract.getEndDate() == null ? "" : contract.getEndDate().toString())
                    .setContractType(contract.getContractType().name())
                    .setGrossHourlyWage(contract.getGrossHourlyWage().toString())
                    .setTravelAllowance(Boolean.TRUE.equals(contract.getTravelAllowance()))
                    .setFunctionId(contract.getFunctionId() == null ? "" : contract.getFunctionId().toString())
                    .setFunctionName(contract.getFunctionName() == null ? "" : contract.getFunctionName())
                    .setPaymentFrequency(contract.getPaymentFrequency() == null ? "" : contract.getPaymentFrequency().name())
                    .setWeeklyHours(contract.getWeeklyHours() == null ? "" : contract.getWeeklyHours().toString())
                    .setHolidayAllowancePercentage(contract.getHolidayAllowancePercentage() == null ? "" : contract.getHolidayAllowancePercentage().toString())
                    .setLeaveEntitlementDays(contract.getLeaveEntitlementDays() == null ? 0 : contract.getLeaveEntitlementDays())
                    .setContractId(contract.getContractId().toString())
                    .setStatus(contract.getStatus().name())
                    .setApplyLoonheffingskorting(!Boolean.FALSE.equals(contract.getApplyLoonheffingskorting()))
                    .setPensionApplicable(!Boolean.FALSE.equals(contract.getPensionApplicable()))
                    .setPensionEmployeePercentage(contract.getPensionEmployeePercentage() == null ? "" : contract.getPensionEmployeePercentage().toString())
                    .setSpecialZvwContribution(Boolean.TRUE.equals(contract.getSpecialZvwContribution()))
                    .setZvwEmployeePercentage(contract.getZvwEmployeePercentage() == null ? "" : contract.getZvwEmployeePercentage().toString())
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (ContractNotFoundException e) {
            responseObserver.onError(Status.NOT_FOUND.withDescription(e.getMessage()).asRuntimeException());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT.withDescription("Bad userId").asRuntimeException());
        } catch (Exception e) {
            responseObserver.onError(Status.UNKNOWN.withDescription("Server error").withCause(e).asRuntimeException());
        }
    }

    private static LocalDate parseOrDefault(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return LocalDate.parse(value);
    }
}
