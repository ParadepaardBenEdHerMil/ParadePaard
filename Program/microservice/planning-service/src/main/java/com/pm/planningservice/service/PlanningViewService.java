package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningDayDTO;
import com.pm.planningservice.dto.PlanningResourceAllocationDTO;
import com.pm.planningservice.dto.PlanningShiftDTO;
import com.pm.planningservice.dto.PlanningViewResponseDTO;
import com.pm.planningservice.integration.UserDirectoryClient;
import com.pm.planningservice.model.Event;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.EventRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PlanningViewService {
    private final ClientCompanyRepository clientCompanyRepository;
    private final EventRepository eventRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final UserDirectoryClient userDirectoryClient;

    public PlanningViewService(
            ClientCompanyRepository clientCompanyRepository,
            EventRepository eventRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            UserDirectoryClient userDirectoryClient) {
        this.clientCompanyRepository = clientCompanyRepository;
        this.eventRepository = eventRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.userDirectoryClient = userDirectoryClient;
    }

    public List<PlanningViewResponseDTO> getPlanningHierarchy(
            UUID companyId,
            UUID eventFilterId,
            LocalDate startDate,
            LocalDate endDate,
            boolean includeAllocationDetails) {
        List<Event> events = resolveEvents(companyId, eventFilterId, startDate, endDate);
        if (events.isEmpty()) {
            return List.of();
        }

        List<UUID> eventIds = events.stream()
                .map(Event::getEventId)
                .toList();
        List<Shift> shifts = resolveShifts(eventIds, eventFilterId, startDate, endDate);
        Map<UUID, List<Shift>> shiftsByEventId = shifts.stream()
                .sorted(Comparator.comparing(Shift::getStartTime))
                .collect(Collectors.groupingBy(Shift::getEventId));

        List<UUID> shiftIds = shifts.stream()
                .map(Shift::getShiftId)
                .toList();

        List<ScheduleEntry> entries = includeAllocationDetails && !shiftIds.isEmpty()
                ? scheduleEntryRepository.findByShiftIdIn(shiftIds)
                : List.of();
        Map<UUID, List<ScheduleEntry>> entriesByShiftId = includeAllocationDetails
                ? entries.stream().collect(Collectors.groupingBy(ScheduleEntry::getShiftId))
                : Map.of();
        Map<UUID, ShiftAssignmentCounts> assignmentCountsByShiftId = includeAllocationDetails
                ? buildAssignmentCountsFromEntries(entriesByShiftId)
                : loadAssignmentCounts(shiftIds);

        Set<UUID> userIds = includeAllocationDetails
                ? entries.stream()
                        .map(ScheduleEntry::getUserId)
                        .collect(Collectors.toSet())
                : Set.of();
        Map<UUID, String> userDisplayNames = includeAllocationDetails
                ? userDirectoryClient.getDisplayNamesByUserIds(userIds)
                : Map.of();
        Map<UUID, String> clientCompanyNames = loadClientCompanyNames(companyId, events);

        return events.stream()
                .map(event -> mapEventHierarchy(
                        event,
                        shiftsByEventId,
                        entriesByShiftId,
                        assignmentCountsByShiftId,
                        userDisplayNames,
                        clientCompanyNames,
                        includeAllocationDetails
                ))
                .toList();
    }

    private List<Event> resolveEvents(UUID companyId, UUID eventFilterId, LocalDate startDate, LocalDate endDate) {
        if (eventFilterId == null) {
            if (hasValidDateRange(startDate, endDate)) {
                return eventRepository.findByCompanyIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateAsc(
                        companyId,
                        endDate,
                        startDate
                );
            }
            return eventRepository.findByCompanyIdOrderByStartDateAsc(companyId);
        }
        return eventRepository.findByEventIdAndCompanyId(eventFilterId, companyId)
                .map(List::of)
                .orElse(List.of());
    }

    private List<Shift> resolveShifts(List<UUID> eventIds, UUID eventFilterId, LocalDate startDate, LocalDate endDate) {
        if (eventIds.isEmpty()) {
            return List.of();
        }
        if (eventFilterId == null && hasValidDateRange(startDate, endDate)) {
            LocalDateTime startInclusive = startDate.atStartOfDay();
            LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();
            return shiftRepository.findByEventIdInAndStartTimeLessThanAndEndTimeGreaterThan(
                    eventIds,
                    endExclusive,
                    startInclusive
            );
        }
        return shiftRepository.findByEventIdIn(eventIds);
    }

    private boolean hasValidDateRange(LocalDate startDate, LocalDate endDate) {
        return startDate != null && endDate != null && !endDate.isBefore(startDate);
    }

    private Map<UUID, ShiftAssignmentCounts> loadAssignmentCounts(List<UUID> shiftIds) {
        if (shiftIds.isEmpty()) {
            return Map.of();
        }

        return scheduleEntryRepository.countAssignmentsByShiftIdIn(
                        shiftIds,
                        ScheduleEntryStatus.CANCELLED,
                        ScheduleEntryStatus.CONFIRMED
                ).stream()
                .collect(Collectors.toMap(
                        ScheduleEntryRepository.ShiftAssignmentCountView::getShiftId,
                        countView -> new ShiftAssignmentCounts(
                                toIntCount(countView.getAssignedCount()),
                                toIntCount(countView.getCheckedInCount())
                        )
                ));
    }

    private Map<UUID, ShiftAssignmentCounts> buildAssignmentCountsFromEntries(
            Map<UUID, List<ScheduleEntry>> entriesByShiftId) {
        if (entriesByShiftId.isEmpty()) {
            return Map.of();
        }

        return entriesByShiftId.entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> countAssignments(entry.getValue())
                ));
    }

    private ShiftAssignmentCounts countAssignments(List<ScheduleEntry> entries) {
        int assignedCount = 0;
        int checkedInCount = 0;
        for (ScheduleEntry entry : entries) {
            if (entry.getStatus() != ScheduleEntryStatus.CANCELLED) {
                assignedCount++;
            }
            if (entry.getStatus() == ScheduleEntryStatus.CONFIRMED) {
                checkedInCount++;
            }
        }
        return new ShiftAssignmentCounts(assignedCount, checkedInCount);
    }

    private int toIntCount(Long count) {
        return count == null ? 0 : Math.toIntExact(count);
    }

    private PlanningViewResponseDTO mapEventHierarchy(
            Event event,
            Map<UUID, List<Shift>> shiftsByEventId,
            Map<UUID, List<ScheduleEntry>> entriesByShiftId,
            Map<UUID, ShiftAssignmentCounts> assignmentCountsByShiftId,
            Map<UUID, String> userDisplayNames,
            Map<UUID, String> clientCompanyNames,
            boolean includeAllocationDetails) {
        PlanningViewResponseDTO response = new PlanningViewResponseDTO();
        response.setEventId(event.getEventId());
        response.setEventName(event.getName());
        response.setStartDate(event.getStartDate());
        response.setEndDate(event.getEndDate());
        response.setClientCompanyId(event.getClientCompanyId());
        response.setClientCompanyName(resolveClientCompanyName(event.getClientCompanyId(), clientCompanyNames));
        response.setInternalDescription(event.getInternalDescription());
        response.setExternalDescription(event.getExternalDescription());
        response.setDefaultStartTime(event.getDefaultStartTime());
        response.setDefaultEndTime(event.getDefaultEndTime());
        response.setEventTimezone(PlanningTimeZoneSupport.normalizeEventTimezone(event.getEventTimezone()));
        response.setLocation(event.getLocation());
        response.setStatus(event.getStatus());
        response.setCreatedByUserId(event.getCreatedByUserId());
        response.setCreatedAt(event.getCreatedAt());
        response.setUpdatedAt(event.getUpdatedAt());
        response.setFinalized(event.getFinalized());
        response.setFinalizedAt(event.getFinalizedAt());

        Map<LocalDate, List<PlanningShiftDTO>> shiftsByDay = new LinkedHashMap<>();
        List<Shift> eventShifts = shiftsByEventId.getOrDefault(event.getEventId(), List.of());
        int peopleNeededTotal = 0;
        for (Shift shift : eventShifts) {
            List<ScheduleEntry> shiftEntries = entriesByShiftId.getOrDefault(shift.getShiftId(), List.of());
            LocalDate day = shift.getStartTime().toLocalDate();
            int peopleNeeded = resolvePeopleNeeded(shift.getPeopleNeeded());
            ShiftAssignmentCounts assignmentCounts = assignmentCountsByShiftId.getOrDefault(
                    shift.getShiftId(),
                    new ShiftAssignmentCounts(0, 0)
            );
            int assignedCount = assignmentCounts.assignedCount();
            int checkedInCount = assignmentCounts.checkedInCount();
            PlanningShiftDTO shiftDto = new PlanningShiftDTO();
            shiftDto.setShiftId(shift.getShiftId());
            shiftDto.setStartTime(shift.getStartTime());
            shiftDto.setEndTime(shift.getEndTime());
            shiftDto.setName(shift.getName());
            shiftDto.setBreakMinutes(resolveBreakMinutes(shift.getBreakMinutes()));
            shiftDto.setLocation(shift.getLocation());
            shiftDto.setPeopleNeeded(peopleNeeded);
            shiftDto.setFunctionName(shift.getFunctionName());
            shiftDto.setAssignedCount(assignedCount);
            shiftDto.setCheckedInCount(checkedInCount);
            shiftDto.setStaffingStatus(resolveStaffingStatus(assignedCount, peopleNeeded));
            if (includeAllocationDetails) {
                shiftDto.setAllocations(shiftEntries.stream()
                        .map(entry -> mapAllocation(shift, entry, userDisplayNames))
                        .sorted(Comparator.comparing(PlanningResourceAllocationDTO::getStartTime))
                        .toList());
            } else {
                shiftDto.setAllocations(List.of());
            }
            shiftsByDay.computeIfAbsent(day, ignored -> new ArrayList<>()).add(shiftDto);
            peopleNeededTotal += peopleNeeded;
        }

        List<PlanningDayDTO> days = shiftsByDay.entrySet().stream()
                .map(dayEntry -> {
                    PlanningDayDTO day = new PlanningDayDTO();
                    day.setDay(dayEntry.getKey());
                    List<PlanningShiftDTO> dayShifts = dayEntry.getValue().stream()
                            .sorted(Comparator.comparing(PlanningShiftDTO::getStartTime))
                            .toList();
                    day.setShifts(dayShifts);
                    if (includeAllocationDetails) {
                        day.setAllocations(dayShifts.stream()
                                .flatMap(shift -> shift.getAllocations().stream())
                                .sorted(Comparator.comparing(PlanningResourceAllocationDTO::getStartTime))
                                .toList());
                    } else {
                        day.setAllocations(List.of());
                    }
                    return day;
                })
                .toList();
        response.setDays(days);
        response.setPeopleNeededTotal(peopleNeededTotal);

        return response;
    }

    private PlanningResourceAllocationDTO mapAllocation(
            Shift shift,
            ScheduleEntry scheduleEntry,
            Map<UUID, String> userDisplayNames) {
        PlanningResourceAllocationDTO dto = new PlanningResourceAllocationDTO();
        dto.setScheduleEntryId(scheduleEntry.getScheduleEntryId());
        dto.setShiftId(shift.getShiftId());
        dto.setUserId(scheduleEntry.getUserId());
        dto.setUserDisplayName(userDisplayNames.get(scheduleEntry.getUserId()));
        dto.setStartTime(shift.getStartTime());
        dto.setEndTime(shift.getEndTime());
        dto.setFunctionName(shift.getFunctionName());
        dto.setStatus(scheduleEntry.getStatus());
        return dto;
    }

    private Map<UUID, String> loadClientCompanyNames(UUID companyId, List<Event> events) {
        Set<UUID> clientCompanyIds = events.stream()
                .map(Event::getClientCompanyId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (clientCompanyIds.isEmpty()) {
            return Map.of();
        }
        return clientCompanyRepository.findNameViewsByOwnerCompanyIdAndClientCompanyIdInOrderByNameAsc(
                        companyId,
                        clientCompanyIds
                ).stream()
                .collect(Collectors.toMap(
                        ClientCompanyRepository.ClientCompanyNameView::getClientCompanyId,
                        ClientCompanyRepository.ClientCompanyNameView::getName
                ));
    }

    private String resolveClientCompanyName(UUID clientCompanyId, Map<UUID, String> clientCompanyNames) {
        if (clientCompanyId == null) {
            return null;
        }
        return clientCompanyNames.get(clientCompanyId);
    }

    private int resolvePeopleNeeded(Integer peopleNeeded) {
        return peopleNeeded == null || peopleNeeded < 1 ? 1 : peopleNeeded;
    }

    private int resolveBreakMinutes(Integer breakMinutes) {
        return breakMinutes == null || breakMinutes < 0 ? 0 : breakMinutes;
    }

    private String resolveStaffingStatus(int assignedCount, int peopleNeeded) {
        if (assignedCount <= 0) {
            return "OPEN";
        }
        if (assignedCount >= peopleNeeded) {
            return "FILLED";
        }
        return "PARTIALLY_FILLED";
    }

    private record ShiftAssignmentCounts(int assignedCount, int checkedInCount) {
    }
}
