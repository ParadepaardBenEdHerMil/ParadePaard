package com.pm.timesheetservice.dto;

/**
 * Optional body for approve/reject calls, carrying a free-text reason
 * that is stored on the timesheet and its audit entry.
 */
public class TimesheetDecisionRequestDTO {
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
