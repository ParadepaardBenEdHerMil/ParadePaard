package com.pm.timesheetservice.service;

import com.pm.timesheetservice.dto.AuditLogCreateRequestDTO;
import com.pm.timesheetservice.dto.AuditLogMessagePartDTO;
import com.pm.timesheetservice.dto.TimesheetRequestDTO;
import com.pm.timesheetservice.dto.TimesheetResponseDTO;
import com.pm.timesheetservice.dto.PagedResponseDTO;

import com.pm.timesheetservice.exception.InvalidTimesheetStateException;
import com.pm.timesheetservice.integration.AuditLogClient;
import com.pm.timesheetservice.exception.TimesheetNotFoundException;
import com.pm.timesheetservice.model.Timesheet;
import com.pm.timesheetservice.model.TimesheetAudit;
import com.pm.timesheetservice.model.TimesheetAuditAction;
import com.pm.timesheetservice.model.TimesheetStatus;
import com.pm.timesheetservice.repository.TimesheetAuditRepository;
import com.pm.timesheetservice.repository.TimesheetRepository;
import com.pm.timesheetservice.mapper.TimesheetMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

    private static final Logger log = LoggerFactory.getLogger(TimesheetService.class);

    private final TimesheetRepository timesheetRepository;
    private final TimesheetAuditRepository auditRepository;
    private final Clock clock;

    // Timesheets keep their own detailed audit trail (TimesheetAudit); this additionally
    // mirrors approve/reject decisions into the company-wide audit log owned by user-service.
    // Optional so the hand-built service unit tests keep working (null => central log skipped).
    @Autowired(required = false)
    private AuditLogClient auditLogClient;

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
        return approveTimesheet(id, actorUserId, reason, null);
    }

    public TimesheetResponseDTO approveTimesheet(UUID id, UUID actorUserId, String reason, String accessToken) {
        return decide(id, TimesheetStatus.APPROVED, TimesheetAuditAction.APPROVED, actorUserId, reason, accessToken);
    }

    /**
     * Reject a PENDING timesheet. Guarded the same way as {@link #approveTimesheet}.
     */
    public TimesheetResponseDTO rejectTimesheet(UUID id, UUID actorUserId, String reason) {
        return rejectTimesheet(id, actorUserId, reason, null);
    }

    public TimesheetResponseDTO rejectTimesheet(UUID id, UUID actorUserId, String reason, String accessToken) {
        return decide(id, TimesheetStatus.REJECTED, TimesheetAuditAction.REJECTED, actorUserId, reason, accessToken);
    }

    public List<TimesheetAudit> getAuditTrail(UUID timesheetId) {
        return auditRepository.findByTimesheetIdOrderByAtAsc(timesheetId);
    }

    private TimesheetResponseDTO decide(UUID id, TimesheetStatus target, TimesheetAuditAction action,
                                        UUID actorUserId, String reason, String accessToken) {
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
        recordCentralAudit(accessToken, action, timesheet);
        return TimesheetMapper.toDTO(timesheet);
    }

    // Mirror the approve/reject decision into the company-wide audit log. The acting admin is
    // resolved by user-service from the forwarded token; the employee link resolves to their
    // name there too. Best-effort: a failure must never break the decision itself.
    private void recordCentralAudit(String accessToken, TimesheetAuditAction action, Timesheet timesheet) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank()) {
            return;
        }
        AuditLogMessagePartDTO verb = new AuditLogMessagePartDTO();
        verb.setType("TEXT");
        verb.setText(" " + action.name().toLowerCase() + " the timesheet for ");

        AuditLogMessagePartDTO who = new AuditLogMessagePartDTO();
        who.setType("LINK");
        who.setEntityType("USER");
        who.setEntityId(timesheet.getUserId() == null ? null : timesheet.getUserId().toString());
        who.setRoute(timesheet.getUserId() == null ? null : "/management/users/" + timesheet.getUserId());

        AuditLogMessagePartDTO detail = new AuditLogMessagePartDTO();
        detail.setType("TEXT");
        detail.setText(" (week " + timesheet.getWeekNumber() + " " + timesheet.getWeekBasedYear() + ")");

        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("TIMESHEETS");
        request.setAction(action.name());
        request.setEntityType("TIMESHEET");
        request.setEntityId(timesheet.getTimesheetId() == null ? null : timesheet.getTimesheetId().toString());
        request.setMessageParts(List.of(verb, who, detail));
        try {
            auditLogClient.record(accessToken, request);
        } catch (RuntimeException ex) {
            log.warn("Failed to record timesheet {} audit event for {}", action, timesheet.getTimesheetId(), ex);
        }
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
