package com.pm.contractservice.dto;

import java.util.UUID;

/**
 * Minimal, non-sensitive view of a job function for the public application form. Deliberately omits
 * department and hourly wage so anonymous callers only ever see the pickable name + id.
 */
public class PublicJobFunctionDTO {
    private UUID functionId;
    private String functionName;

    public PublicJobFunctionDTO() {
    }

    public PublicJobFunctionDTO(UUID functionId, String functionName) {
        this.functionId = functionId;
        this.functionName = functionName;
    }

    public UUID getFunctionId() {
        return functionId;
    }

    public void setFunctionId(UUID functionId) {
        this.functionId = functionId;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }
}
