package com.pm.timesheetservice.exception;

public class TimesheetNotFoundException extends RuntimeException {
    public TimesheetNotFoundException(String message) {
        super(message);
    }
}
