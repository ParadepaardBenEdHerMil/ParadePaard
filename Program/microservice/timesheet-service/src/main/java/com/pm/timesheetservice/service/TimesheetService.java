package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.dto.PagedResponseDTO;

import com.pm.timesheetservice.exception.InvalidTimesheetStateException;
import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.model.TimesheetAudit;
import com.pm.timesheetservice.model.TimesheetAuditAction;
import com.pm.timesheetservice.model.TimesheetStatus;
import com.pm.timesheetservice.repository.TimesheetAuditRepository;
import com.pm.timesheetservice.repository.TimesheetRepository;
import com.pm.timesheetservice.mapper.TimesheetMapper;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.UUID;

@Service
public class TimesheetService {

    private final TimesheetRepository timesheetRepository;
    private final TimesheetAuditRepository auditRepository;
    private final Clock clock;

    public TimesheetService(TimesheetRepository timesheetRepository,
                            TimesheetAuditRepository auditRepository,
                            Clock clock) {
        this.timesheetRepository = timesheetRepository;
        this.auditRepository = auditRepository;
        this.clock = clock;
    }

    public List<TimesheetResponseDTO> getTimesheets(){
        List<Timesheet> timesheets = timesheetRepository.findAll();
        return timesheets.stream().map(TimesheetMapper::toDTO).toList();
    }

    public PagedResponseDTO<TimesheetResponseDTO> getTimesheetsPage(int page, int size) {
        return PagedResponseDTO.from(
                timesheetRepository.findAllByOrderByDateOfIssueDesc(PageRequest.of(page, size)),
                TimesheetMapper::toDTO
        );
    }

    public List<TimesheetResponseDTO> getTimesheetsByUserId(UUID userId) {
        return timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId)
                .stream()
                .map(TimesheetMapper::toDTO)
                .toList();
    }

    public PagedResponseDTO<TimesheetResponseDTO> getTimesheetsByUserIdPage(UUID userId, int page, int size) {
        return PagedResponseDTO.from(
                timesheetRepository.findByUserIdOrderByDateOfIssueDesc(userId, PageRequest.of(page, size)),
                TimesheetMapper::toDTO
        );
    }

    public TimesheetResponseDTO getTimesheetById(UUID id) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new TimesheetNotFoundException("Timesheet with id: " + id + " not found"));
        return TimesheetMapper.toDTO(timesheet);
    }

    public TimesheetResponseDTO createTimesheet(TimesheetRequestDTO timesheetRequestDTO){
        return createTimesheet(timesheetRequestDTO, null);
    }

    public TimesheetResponseDTO createTimesheet(TimesheetRequestDTO timesheetRequestDTO, UUID actorUserId){
        LocalDate date = LocalDate.parse(timesheetRequestDTO.getDateOfIssue());

        //TODO barmedewerker, barrunner, barhoofd, feldrunner functies check,

        Timesheet timesheet = TimesheetMapper.toModel(timesheetRequestDTO);
        timesheet.setWeekNumber(date.get(WeekFields.ISO.weekOfWeekBasedYear()));
        timesheet.setWeekBasedYear(date.get(WeekFields.ISO.weekBasedYear()));
        timesheet.setStatus(TimesheetStatus.PENDING);

        timesheet = timesheetRepository.save(timesheet);
        writeAudit(timesheet.getTimesheetId(), TimesheetAuditAction.CREATED, actorUserId,
                null, TimesheetStatus.PENDING, null);
        return TimesheetMapper.toDTO(timesheet);
    }

    public TimesheetResponseDTO updateTimesheet(UUID id, TimesheetRequestDTO timesheetRequestDTO){
        return updateTimesheet(id, timesheetRequestDTO, null);
    }

    public TimesheetResponseDTO updateTimesheet(UUID id, TimesheetRequestDTO timesheetRequestDTO, UUID actorUserId){
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new TimesheetNotFoundException("Timesheet with id: " + id + " not found"));

        timesheet.setUserId(UUID.fromString(timesheetRequestDTO.getUserId()));
        timesheet.setName(timesheetRequestDTO.getName());
        timesheet.setDateOfIssue(LocalDate.parse(timesheetRequestDTO.getDateOfIssue()));
        timesheet.setFunction(timesheetRequestDTO.getFunction());
        timesheet.setHoursWorked(timesheetRequestDTO.getHoursWorked());
        timesheet.setTravelExpenses(timesheetRequestDTO.getTravelExpenses());
        timesheet.setSourceScheduleEntryId(timesheetRequestDTO.getSourceScheduleEntryId() == null || timesheetRequestDTO.getSourceScheduleEntryId().isBlank()
                ? null : UUID.fromString(timesheetRequestDTO.getSourceScheduleEntryId()));
        timesheet.setSourceShiftId(timesheetRequestDTO.getSourceShiftId() == null || timesheetRequestDTO.getSourceShiftId().isBlank()
                ? null : UUID.fromString(timesheetRequestDTO.getSourceShiftId()));
        timesheet.setSourceProjectId(timesheetRequestDTO.getSourceProjectId() == null || timesheetRequestDTO.getSourceProjectId().isBlank()
                ? null : UUID.fromString(timesheetRequestDTO.getSourceProjectId()));
        timesheet.setProjectName(timesheetRequestDTO.getProjectName());
        timesheet.setShiftName(timesheetRequestDTO.getShiftName());
        timesheet.setShiftDate(timesheetRequestDTO.getShiftDate() == null || timesheetRequestDTO.getShiftDate().isBlank()
                ? null : LocalDate.parse(timesheetRequestDTO.getShiftDate()));
        timesheet.setShiftStartTime(timesheetRequestDTO.getShiftStartTime() == null || timesheetRequestDTO.getShiftStartTime().isBlank()
                ? null : java.time.LocalDateTime.parse(timesheetRequestDTO.getShiftStartTime()));
        timesheet.setShiftEndTime(timesheetRequestDTO.getShiftEndTime() == null || timesheetRequestDTO.getShiftEndTime().isBlank()
                ? null : java.time.LocalDateTime.parse(timesheetRequestDTO.getShiftEndTime()));
        timesheet.setBreakMinutes(timesheetRequestDTO.getBreakMinutes());
        timesheet.setTravelKilometers(timesheetRequestDTO.getTravelKilometers());
        timesheet.setTravelRate(timesheetRequestDTO.getTravelRate());

        timesheet = timesheetRepository.save(timesheet);
        writeAudit(timesheet.getTimesheetId(), TimesheetAuditAction.UPDATED, actorUserId,
                timesheet.getStatus(), timesheet.getStatus(), null);
        return TimesheetMapper.toDTO(timesheet);
    }

    /**
     * Approve a PENDING timesheet. A timesheet that is already APPROVED or REJECTED
     * cannot be flipped — that raises {@link InvalidTimesheetStateException} (HTTP 409).
     */
    public TimesheetResponseDTO approveTimesheet(UUID id, UUID actorUserId, String reason) {
        return decide(id, TimesheetStatus.APPROVED, TimesheetAuditAction.APPROVED, actorUserId, reason);
    }

    /**
     * Reject a PENDING timesheet. Guarded the same way as {@link #approveTimesheet}.
     */
    public TimesheetResponseDTO rejectTimesheet(UUID id, UUID actorUserId, String reason) {
        return decide(id, TimesheetStatus.REJECTED, TimesheetAuditAction.REJECTED, actorUserId, reason);
    }

    public List<TimesheetAudit> getAuditTrail(UUID timesheetId) {
        return auditRepository.findByTimesheetIdOrderByAtAsc(timesheetId);
    }

    private TimesheetResponseDTO decide(UUID id, TimesheetStatus target, TimesheetAuditAction action,
                                        UUID actorUserId, String reason) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new TimesheetNotFoundException("Timesheet with id: " + id + " not found"));

        TimesheetStatus current = timesheet.getStatus();
        if (current != TimesheetStatus.PENDING) {
            throw new InvalidTimesheetStateException(
                    "Timesheet " + id + " is " + current + " and can no longer be " + target);
        }

        timesheet.setStatus(target);
        timesheet.setDecidedByUserId(actorUserId);
        timesheet.setDecidedAt(OffsetDateTime.now(clock));
        timesheet.setDecisionReason(reason);
        timesheet = timesheetRepository.save(timesheet);

        writeAudit(timesheet.getTimesheetId(), action, actorUserId, current, target, reason);
        return TimesheetMapper.toDTO(timesheet);
    }

    private void writeAudit(UUID timesheetId, TimesheetAuditAction action, UUID actorUserId,
                            TimesheetStatus from, TimesheetStatus to, String reason) {
        auditRepository.save(new TimesheetAudit(
                timesheetId, action, actorUserId, from, to, reason, OffsetDateTime.now(clock)));
    }

    public void deleteTimesheet(UUID id){
        timesheetRepository.deleteById(id);
    }
}
