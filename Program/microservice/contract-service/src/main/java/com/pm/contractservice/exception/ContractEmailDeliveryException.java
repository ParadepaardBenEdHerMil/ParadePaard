package com.pm.contractservice.exception;

public class ContractEmailDeliveryException extends RuntimeException {
    public ContractEmailDeliveryException(String message) {
        super(message);
    }

    public ContractEmailDeliveryException(String message, Throwable cause) {
        super(message, cause);
    }
}
