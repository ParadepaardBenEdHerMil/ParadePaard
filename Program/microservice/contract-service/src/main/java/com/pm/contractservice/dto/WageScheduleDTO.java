package com.pm.contractservice.dto;

import java.util.List;

/**
 * The full editable minimum wage schedule: every dated table, newest effective date first.
 * Read by the Horeca payroll rules page to show and edit the enforced wage floor.
 */
public class WageScheduleDTO {

    private List<WageScheduleEntryDTO> entries;

    public WageScheduleDTO() {
    }

    public WageScheduleDTO(List<WageScheduleEntryDTO> entries) {
        this.entries = entries;
    }

    public List<WageScheduleEntryDTO> getEntries() {
        return entries;
    }

    public void setEntries(List<WageScheduleEntryDTO> entries) {
        this.entries = entries;
    }
}
