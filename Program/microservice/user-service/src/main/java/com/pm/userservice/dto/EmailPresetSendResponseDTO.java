package com.pm.userservice.dto;

public class EmailPresetSendResponseDTO {
    private int requested;
    private int sent;

    public EmailPresetSendResponseDTO() {
    }

    public EmailPresetSendResponseDTO(int requested, int sent) {
        this.requested = requested;
        this.sent = sent;
    }

    public int getRequested() {
        return requested;
    }

    public void setRequested(int requested) {
        this.requested = requested;
    }

    public int getSent() {
        return sent;
    }

    public void setSent(int sent) {
        this.sent = sent;
    }
}
