package com.pm.planningservice.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class PlanningDayDTO {
    private LocalDate day;
    private List<PlanningResourceAllocationDTO> allocations = new ArrayList<>();
    private List<PlanningShiftDTO> shifts = new ArrayList<>();

    public LocalDate getDay() {
        return day;
    }

    public void setDay(LocalDate day) {
        this.day = day;
    }

    public List<PlanningResourceAllocationDTO> getAllocations() {
        return allocations;
    }

    public void setAllocations(List<PlanningResourceAllocationDTO> allocations) {
        this.allocations = allocations;
    }

    public List<PlanningShiftDTO> getShifts() {
        return shifts;
    }

    public void setShifts(List<PlanningShiftDTO> shifts) {
        this.shifts = shifts;
    }
}
