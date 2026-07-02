package com.pm.userservice.grpc;

import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.LeaveQueryService;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import user.LeaveHoursRequest;
import user.LeaveHoursResponse;
import user.LeaveOverlapRequest;
import user.LeaveOverlapResponse;
import user.UserDataRequest;
import user.UserDataResponse;
import user.UserServiceGrpc;

import java.time.LocalDate;
import java.util.UUID;

@GrpcService
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {

    private final UserRepository userRepository;
    private final LeaveQueryService leaveQueryService;

    public UserGrpcService(UserRepository userRepository, LeaveQueryService leaveQueryService) {
        this.userRepository = userRepository;
        this.leaveQueryService = leaveQueryService;
    }

    @Override
    public void getApprovedLeaveHours(LeaveHoursRequest request, StreamObserver<LeaveHoursResponse> responseObserver) {
        LeaveQueryService.LeaveHours hours = leaveQueryService.approvedLeaveHours(
                UUID.fromString(request.getUserId()),
                LocalDate.parse(request.getFromDate()),
                LocalDate.parse(request.getToDate()));
        responseObserver.onNext(LeaveHoursResponse.newBuilder()
                .setPaidLeaveHours(hours.paidHours().toPlainString())
                .setSickLeaveHours(hours.sickHours().toPlainString())
                .setUnpaidLeaveHours(hours.unpaidHours().toPlainString())
                .build());
        responseObserver.onCompleted();
    }

    @Override
    public void hasApprovedLeaveOverlap(LeaveOverlapRequest request, StreamObserver<LeaveOverlapResponse> responseObserver) {
        boolean overlap = leaveQueryService.hasApprovedLeaveOverlapping(
                UUID.fromString(request.getUserId()),
                LocalDate.parse(request.getFromDate()),
                LocalDate.parse(request.getToDate()));
        responseObserver.onNext(LeaveOverlapResponse.newBuilder().setHasOverlap(overlap).build());
        responseObserver.onCompleted();
    }

    @Override
    public void requestUserData(UserDataRequest request, StreamObserver<UserDataResponse> responseObserver) {
        UUID userId = UUID.fromString(request.getUserId());
        User user = userRepository.findByUserId(userId).orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));

        UserDataResponse response = UserDataResponse.newBuilder()
                .setName(buildFullName(user))
                .setPreferredName(nullSafe(user.getPreferredName()))
                .setFirstNames(nullSafe(user.getFirstNames()))
                .setMiddleNamePrefix(nullSafe(user.getMiddleNamePrefix()))
                .setLastName(nullSafe(user.getLastName()))
                .setGender(nullSafe(user.getGender()))
                .setDateOfBirth(user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : "")
                .setStreetName(nullSafe(user.getStreet()))
                .setHouseNumber(nullSafe(user.getHouseNumber()))
                .setHouseNumberSuffix(nullSafe(user.getHouseNumberSuffix()))
                .setPostalCode(nullSafe(user.getPostalCode()))
                .setCity(nullSafe(user.getCity()))
                .setCountry(nullSafe(user.getCountry()))
                .setEmail(nullSafe(user.getEmail()))
                .setMobileNumber(nullSafe(user.getMobileNumber()))
                .setIban(nullSafe(user.getIban()))
                .setCompanyId(user.getCompanyId() != null ? user.getCompanyId().toString() : "")
                .setBsn(nullSafe(user.getBsn()))
                .setApplyLoonheffingskorting(user.isApplyLoonheffingskorting())
                .setPensionParticipant(user.isPensionParticipant())
                .setSpecialZvwContribution(user.isSpecialZvwContribution())
                .setPayrollNotes(nullSafe(user.getPayrollNotes()))
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private static String buildFullName(User user) {
        StringBuilder name = new StringBuilder();
        if (user.getFirstNames() != null && !user.getFirstNames().isBlank()) {
            name.append(user.getFirstNames());
        }
        if (user.getMiddleNamePrefix() != null && !user.getMiddleNamePrefix().isBlank()) {
            if (name.length() > 0) {
                name.append(" ");
            }
            name.append(user.getMiddleNamePrefix());
        }
        if (user.getLastName() != null && !user.getLastName().isBlank()) {
            if (name.length() > 0) {
                name.append(" ");
            }
            name.append(user.getLastName());
        }
        if (name.length() == 0) {
            return nullSafe(user.getPreferredName());
        }
        return name.toString();
    }
}
