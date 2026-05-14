package com.pm.contractservice.service;

import com.pm.contractservice.exception.ContractEmailDeliveryException;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import user.UserDataResponse;

@Service
public class ContractNotificationService {
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractEmailSender contractEmailSender;
    private final String contractUrl;

    public ContractNotificationService(
            UserServiceGrpcClient userServiceGrpcClient,
            ContractEmailSender contractEmailSender,
            @Value("${contract.email.contract-url:http://localhost:5173/account/employment}") String contractUrl
    ) {
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractEmailSender = contractEmailSender;
        this.contractUrl = contractUrl;
    }

    public void sendContractReady(Contract contract) {
        UserDataResponse userData = userServiceGrpcClient.requestUserData(contract.getUserId().toString());
        String email = userData.getEmail() == null ? "" : userData.getEmail().trim();
        if (email.isBlank()) {
            throw new ContractEmailDeliveryException("Employee email address is missing");
        }

        contractEmailSender.sendContractReadyEmail(email, displayName(userData), contractUrl);
    }

    private static String displayName(UserDataResponse userData) {
        String preferredName = userData.getPreferredName();
        if (preferredName != null && !preferredName.isBlank()) {
            return preferredName.trim();
        }

        StringBuilder fullName = new StringBuilder();
        appendNamePart(fullName, userData.getFirstNames());
        appendNamePart(fullName, userData.getMiddleNamePrefix());
        appendNamePart(fullName, userData.getLastName());
        return fullName.toString();
    }

    private static void appendNamePart(StringBuilder fullName, String part) {
        if (part == null || part.isBlank()) {
            return;
        }
        if (!fullName.isEmpty()) {
            fullName.append(' ');
        }
        fullName.append(part.trim());
    }
}
