package com.pm.payrollservice.exception;

public class PayslipNotFoundException extends RuntimeException {
  public PayslipNotFoundException(String message) {
    super(message);
  }
}
