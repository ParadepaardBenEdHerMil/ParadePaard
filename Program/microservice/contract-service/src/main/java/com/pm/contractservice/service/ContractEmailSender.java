package com.pm.contractservice.service;

public interface ContractEmailSender {
    void sendContractReadyEmail(String toEmail, String employeeName, String contractUrl);
}
