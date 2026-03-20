package com.pm.planningservice.service;

import com.pm.planningservice.dto.FinalizePlanningRequestDTO;
import com.pm.planningservice.dto.FinalizePlanningResponseDTO;
import com.pm.planningservice.integration.TimesheetGrpcClient;
import com.pm.planningservice.model.Event;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.EventRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import timesheet.ImportPlannedTimesheetsResponse;
import timesheet.PlannedTimesheetRecord;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PlanningFinalizationService {
    private static final Set<ScheduleEntryStatus> EXPORTABLE_STATUSES = EnumSet.of(
            ScheduleEntryStatus.ASSIGNED,
            ScheduleEntryStatus.CONFIRMED
    );

    private final EventRepository eventRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final TimesheetGrpcClient timesheetGrpcClient;

    public PlanningFinalizationService(
            EventRepository eventRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            TimesheetGrpcClient timesheetGrpcClient) {
        this.eventRepository = eventRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.timesheetGrpcClient = timesheetGrpcClient;
    }

    @Transactional
    public FinalizePlanningResponseDTO finalizePlanning(FinalizePlanningRequestDTO request) {
        validateRequest(request);

        TimeWindow weekWindow = request.getEventId() == null
                ? toIsoWeekWindow(request.getIsoWeek(), request.getWeekBasedYear())
                : null;
        List<Event> candidateEvents = request.getEventId() != null
                ? resolveSingleEvent(request.getCompanyId(), request.getEventId())
                : resolveEventsByIsoWeek(request.getCompanyId(), weekWindow);

        List<Event> targetEvents = candidateEvents.stream()
                .filter(event -> !Boolean.TRUE.equals(event.getFinalized()))
                .toList();
        if (targetEvents.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        List<UUID> eventIds = targetEvents.stream().map(Event::getEventId).toList();
        Set<UUID> eventIdSet = Set.copyOf(eventIds);
        List<Shift> shifts = request.getEventId() != null
                ? shiftRepository.findByEventIdIn(eventIds)
                : shiftRepository.findByStartTimeGreaterThanEqualAndStartTimeLessThan(weekWindow.start(), weekWindow.end())
                .stream()
                .filter(shift -> eventIdSet.contains(shift.getEventId()))
                .toList();
        shifts = shifts.stream()
                .sorted(Comparator.comparing(Shift::getStartTime))
                .toList();
        if (shifts.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        Map<UUID, Event> eventById = targetEvents.stream()
                .collect(Collectors.toMap(Event::getEventId, event -> event));
        Map<UUID, Shift> shiftById = shifts.stream()
                .collect(Collectors.toMap(Shift::getShiftId, shift -> shift));

        List<UUID> shiftIds = shifts.stream().map(Shift::getShiftId).toList();
        List<ScheduleEntry> entries = scheduleEntryRepository.findByShiftIdInAndStatusIn(shiftIds, EXPORTABLE_STATUSES);

        List<PlannedTimesheetRecord> records = entries.stream()
                .map(entry -> toTimesheetRecord(entry, shiftById, eventById))
                .filter(record -> record != null)
                .toList();
        if (records.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        ImportPlannedTimesheetsResponse grpcResponse = timesheetGrpcClient.importPlannedTimesheets("planning-service", records);

        LocalDateTime now = LocalDateTime.now();
        targetEvents.forEach(event -> {
            event.setFinalized(true);
            event.setFinalizedAt(now);
            event.setStatus("COMPLETED");
            event.setUpdatedAt(now);
        });
        eventRepository.saveAll(targetEvents);

        FinalizePlanningResponseDTO response = new FinalizePlanningResponseDTO();
        response.setCreatedTimesheets(grpcResponse.getCreatedCount());
        response.setFinalizedEventIds(targetEvents.stream().map(Event::getEventId).toList());
        response.setWarnings(new ArrayList<>(grpcResponse.getWarningsList()));
        return response;
    }

    private List<Event> resolveSingleEvent(UUID companyId, UUID eventId) {
        return eventRepository.findByEventIdAndCompanyId(eventId, companyId)
                .map(List::of)
                .orElse(List.of());
    }

    private List<Event> resolveEventsByIsoWeek(UUID companyId, TimeWindow weekWindow) {
        List<Shift> weekShifts = shiftRepository.findByStartTimeGreaterThanEqualAndStartTimeLessThan(
                weekWindow.start(),
                weekWindow.end()
        );
        Set<UUID> weekEventIds = weekShifts.stream()
                .map(Shift::getEventId)
                .collect(Collectors.toSet());
        if (weekEventIds.isEmpty()) {
            return List.of();
        }

        return eventRepository.findByEventIdIn(weekEventIds).stream()
                .filter(event -> companyId.equals(event.getCompanyId()))
                .toList();
    }

    private TimeWindow toIsoWeekWindow(Integer isoWeek, Integer weekBasedYear) {
        LocalDate startOfWeek = LocalDate.of(weekBasedYear, 1, 4)
                .with(WeekFields.ISO.weekOfWeekBasedYear(), isoWeek)
                .with(WeekFields.ISO.dayOfWeek(), 1);
        return new TimeWindow(startOfWeek.atStartOfDay(), startOfWeek.plusDays(7).atStartOfDay());
    }

    private PlannedTimesheetRecord toTimesheetRecord(
            ScheduleEntry scheduleEntry,
            Map<UUID, Shift> shiftById,
            Map<UUID, Event> eventById) {
        Shift shift = shiftById.get(scheduleEntry.getShiftId());
        if (shift == null) {
            return null;
        }
        Event event = eventById.get(shift.getEventId());
        if (event == null) {
            return null;
        }

        BigDecimal hoursWorked = durationToHours(shift);
        return PlannedTimesheetRecord.newBuilder()
                .setUserId(scheduleEntry.getUserId().toString())
                .setDateOfIssue(shift.getStartTime().toLocalDate().toString())
                .setName(event.getName())
                .setFunction(shift.getFunctionName())
                .setHoursWorked(hoursWorked.toPlainString())
                .setTravelExpenses("0.00")
                .setSourceEventId(event.getEventId().toString())
                .setSourceShiftId(shift.getShiftId().toString())
                .setSourceScheduleEntryId(scheduleEntry.getScheduleEntryId().toString())
                .build();
    }

    private BigDecimal durationToHours(Shift shift) {
        long breakMinutes = Math.max(0, shift.getBreakMinutes() == null ? 0 : shift.getBreakMinutes());
        Duration duration = Duration.between(shift.getStartTime(), shift.getEndTime()).minusMinutes(breakMinutes);
        if (duration.isNegative()) {
            duration = Duration.ZERO;
        }
        BigDecimal minutes = BigDecimal.valueOf(duration.toMinutes());
        return minutes.divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private void validateRequest(FinalizePlanningRequestDTO request) {
        boolean hasEvent = request.getEventId() != null;
        boolean hasWeek = request.getIsoWeek() != null || request.getWeekBasedYear() != null;

        if (hasEvent && hasWeek) {
            throw new IllegalArgumentException("Provide either eventId or isoWeek/weekBasedYear, not both");
        }
        if (!hasEvent && !hasWeek) {
            throw new IllegalArgumentException("Provide eventId or isoWeek/weekBasedYear");
        }
        if (!hasEvent && (request.getIsoWeek() == null || request.getWeekBasedYear() == null)) {
            throw new IllegalArgumentException("Both isoWeek and weekBasedYear are required for week finalization");
        }
        if (!hasEvent && (request.getIsoWeek() < 1 || request.getIsoWeek() > 53)) {
            throw new IllegalArgumentException("isoWeek must be between 1 and 53");
        }
    }

    private record TimeWindow(LocalDateTime start, LocalDateTime end) {
    }
}
