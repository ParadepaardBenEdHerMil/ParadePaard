package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;

import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.repository.TimesheetRepository;
import com.pm.timesheetservice.mapper.TimesheetMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.UUID;

@Service
public class TimesheetService {

    private final TimesheetRepository timesheetRepository;
    public TimesheetService(TimesheetRepository timesheetRepository){
        this.timesheetRepository = timesheetRepository;
    }

    public List<TimesheetResponseDTO> getTimesheets(){
        List<Timesheet> timesheets = timesheetRepository.findAll();
        return timesheets.stream().map(TimesheetMapper::toDTO).toList();
    }

    public TimesheetResponseDTO createTimesheet(TimesheetRequestDTO timesheetRequestDTO){
        LocalDate date = LocalDate.parse(timesheetRequestDTO.getDateOfIssue());

        //TODO barmedewerker, barrunner, barhoofd, feldrunner functies check,

        Timesheet timesheet = TimesheetMapper.toModel(timesheetRequestDTO);
        timesheet.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
        timesheet.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));

        timesheet = timesheetRepository.save(timesheet);
        return TimesheetMapper.toDTO(timesheet);
    }

    public TimesheetResponseDTO updateTimesheet(UUID id,TimesheetRequestDTO timesheetRequestDTO){
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new TimesheetNotFoundException("Timesheet with id: " + id + " not found"));

        timesheet.setUserId(UUID.fromString(timesheetRequestDTO.getUserId()));
        timesheet.setName(timesheetRequestDTO.getName());
        timesheet.setDateOfIssue(LocalDate.parse(timesheetRequestDTO.getDateOfIssue()));
        timesheet.setFunction(timesheetRequestDTO.getFunction());
        timesheet.setHoursWorked(timesheetRequestDTO.getHoursWorked());
        timesheet.setTravelExpenses(timesheetRequestDTO.getTravelExpenses());

        timesheet = timesheetRepository.save(timesheet);
        return TimesheetMapper.toDTO(timesheet);
    }

    public void deleteTimesheet(UUID id){
        timesheetRepository.deleteById(id);
    }
}
