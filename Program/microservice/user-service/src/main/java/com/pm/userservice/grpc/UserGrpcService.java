package com.pm.userservice.grpc;

import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import user.UserDataRequest;
import user.UserDataResponse;
import user.UserServiceGrpc;

import java.util.UUID;

@GrpcService
public class UserGrpcService extends UserServiceGrpc.UserServiceImplBase {

    private final UserRepository userRepository;

    public UserGrpcService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void requestUserData(UserDataRequest request, StreamObserver<UserDataResponse> responseObserver) {
        UUID userId = UUID.fromString(request.getUserId());
        User user = userRepository.findByUserId(userId).orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));

        UserDataResponse response = UserDataResponse.newBuilder() //TODO fail save maybe?
                .setName(user.getName())
                .setDateOfBirth(user.getDateOfBirth().toString())
                .setStreetName(user.getStreetName())
                .setHouseNumber(user.getHouseNumber())
                .setHouseNumberSuffix(user.getHouseNumberSuffix() == null ? "" : user.getHouseNumberSuffix())
                .setPostalCode(user.getPostalCode())
                .setCity(user.getCity())
                .setCountry(user.getCountry())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
