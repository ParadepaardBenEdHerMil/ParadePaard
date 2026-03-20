package com.pm.planningservice.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PlanningShiftDTO {
    private UUID shiftId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String name;
    private Integer breakMinutes;
    private String location;
    private Integer peopleNeeded;
    private String functionName;
    private Integer assignedCount;
    private String staffingStatus;
    private List<PlanningResourceAllocationDTO> allocations = new ArrayList<>();

    public UUID getShiftId() {
        return shiftId;
    }

    public void setShiftId(UUID shiftId) {
        this.shiftId = shiftId;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getBreakMinutes() {
        return breakMinutes;
    }

    public void setBreakMinutes(Integer breakMinutes) {
        this.breakMinutes = breakMinutes;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public Integer getPeopleNeeded() {
        return peopleNeeded;
    }

    public void setPeopleNeeded(Integer peopleNeeded) {
        this.peopleNeeded = peopleNeeded;
    }

    public String getFunctionName() {
        return functionName;
    }

    public void setFunctionName(String functionName) {
        this.functionName = functionName;
    }

    public Integer getAssignedCount() {
        return assignedCount;
    }

    public void setAssignedCount(Integer assignedCount) {
        this.assignedCount = assignedCount;
    }

    public String getStaffingStatus() {
        return staffingStatus;
    }

    public void setStaffingStatus(String staffingStatus) {
        this.staffingStatus = staffingStatus;
    }

    public List<PlanningResourceAllocationDTO> getAllocations() {
        return allocations;
    }

    public void setAllocations(List<PlanningResourceAllocationDTO> allocations) {
        this.allocations = allocations;
    }
}
