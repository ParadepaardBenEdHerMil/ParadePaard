package com.pm.timesheetservice.mapper;

import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.model.Timesheet;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class TimesheetMapper {
    public static TimesheetResponseDTO toDTO(Timesheet timesheet){
        TimesheetResponseDTO timesheetResponseDTO = new TimesheetResponseDTO();

        timesheetResponseDTO.setTimesheetId(timesheet.getTimesheetId().toString());
        timesheetResponseDTO.setUserId(timesheet.getUserId().toString());
        timesheetResponseDTO.setCompanyId(asString(timesheet.getCompanyId()));
        timesheetResponseDTO.setName(timesheet.getName());
        timesheetResponseDTO.setDateOfIssue(timesheet.getDateOfIssue().toString());
        timesheetResponseDTO.setWeekNumber(timesheet.getWeekNumber());
        timesheetResponseDTO.setWeekBasedYear(timesheet.getWeekBasedYear());
        timesheetResponseDTO.setFunction(timesheet.getFunction());
        timesheetResponseDTO.setHoursWorked(timesheet.getHoursWorked());
        timesheetResponseDTO.setTravelExpenses(timesheet.getTravelExpenses());
        timesheetResponseDTO.setSourceScheduleEntryId(asString(timesheet.getSourceScheduleEntryId()));
        timesheetResponseDTO.setSourceShiftId(asString(timesheet.getSourceShiftId()));
        timesheetResponseDTO.setSourceProjectId(asString(timesheet.getSourceProjectId()));
        timesheetResponseDTO.setProjectName(timesheet.getProjectName());
        timesheetResponseDTO.setShiftName(timesheet.getShiftName());
        timesheetResponseDTO.setShiftDate(asString(timesheet.getShiftDate()));
        timesheetResponseDTO.setShiftStartTime(asString(timesheet.getShiftStartTime()));
        timesheetResponseDTO.setShiftEndTime(asString(timesheet.getShiftEndTime()));
        timesheetResponseDTO.setBreakMinutes(timesheet.getBreakMinutes());
        timesheetResponseDTO.setTravelKilometers(timesheet.getTravelKilometers());
        timesheetResponseDTO.setTravelRate(timesheet.getTravelRate());
        timesheetResponseDTO.setStatus(timesheet.getStatus().name());
        timesheetResponseDTO.setDecidedByUserId(asString(timesheet.getDecidedByUserId()));
        timesheetResponseDTO.setDecidedAt(timesheet.getDecidedAt() == null ? null : timesheet.getDecidedAt().toString());
        timesheetResponseDTO.setDecisionReason(timesheet.getDecisionReason());

        return timesheetResponseDTO;
    }

    public static Timesheet toModel(TimesheetRequestDTO timesheetRequestDTO){
        Timesheet timesheet = new Timesheet();

        timesheet.setUserId(UUID.fromString(timesheetRequestDTO.getUserId()));
        timesheet.setName(timesheetRequestDTO.getName());
        timesheet.setDateOfIssue(LocalDate.parse(timesheetRequestDTO.getDateOfIssue()));
        timesheet.setFunction(timesheetRequestDTO.getFunction());
        timesheet.setHoursWorked(timesheetRequestDTO.getHoursWorked());
        timesheet.setTravelExpenses(timesheetRequestDTO.getTravelExpenses());
        timesheet.setSourceScheduleEntryId(parseUuid(timesheetRequestDTO.getSourceScheduleEntryId()));
        timesheet.setSourceShiftId(parseUuid(timesheetRequestDTO.getSourceShiftId()));
        timesheet.setSourceProjectId(parseUuid(timesheetRequestDTO.getSourceProjectId()));
        timesheet.setProjectName(timesheetRequestDTO.getProjectName());
        timesheet.setShiftName(timesheetRequestDTO.getShiftName());
        timesheet.setShiftDate(parseDate(timesheetRequestDTO.getShiftDate()));
        timesheet.setShiftStartTime(parseDateTime(timesheetRequestDTO.getShiftStartTime()));
        timesheet.setShiftEndTime(parseDateTime(timesheetRequestDTO.getShiftEndTime()));
        timesheet.setBreakMinutes(timesheetRequestDTO.getBreakMinutes());
        timesheet.setTravelKilometers(timesheetRequestDTO.getTravelKilometers());
        timesheet.setTravelRate(timesheetRequestDTO.getTravelRate());

        return timesheet;
    }

    private static UUID parseUuid(String value) {
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    private static LocalDate parseDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value);
    }

    private static LocalDateTime parseDateTime(String value) {
        return value == null || value.isBlank() ? null : LocalDateTime.parse(value);
    }

    private static String asString(UUID value) {
        return value == null ? null : value.toString();
    }

    private static String asString(LocalDate value) {
        return value == null ? null : value.toString();
    }

    private static String asString(LocalDateTime value) {
        return value == null ? null : value.toString();
    }
}
