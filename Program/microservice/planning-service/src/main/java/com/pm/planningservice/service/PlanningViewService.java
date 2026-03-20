package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningDayDTO;
import com.pm.planningservice.dto.PlanningResourceAllocationDTO;
import com.pm.planningservice.dto.PlanningShiftDTO;
import com.pm.planningservice.dto.PlanningViewResponseDTO;
import com.pm.planningservice.integration.UserDirectoryClient;
import com.pm.planningservice.model.ClientCompany;
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

    public List<PlanningViewResponseDTO> getPlanningHierarchy(UUID companyId, UUID eventFilterId) {
        List<Event> events = resolveEvents(companyId, eventFilterId);
        if (events.isEmpty()) {
            return List.of();
        }

        List<UUID> eventIds = events.stream()
                .map(Event::getEventId)
                .toList();
        List<Shift> shifts = shiftRepository.findByEventIdIn(eventIds);
        Map<UUID, List<Shift>> shiftsByEventId = shifts.stream()
                .sorted(Comparator.comparing(Shift::getStartTime))
                .collect(Collectors.groupingBy(Shift::getEventId));

        List<UUID> shiftIds = shifts.stream()
                .map(Shift::getShiftId)
                .toList();

        List<ScheduleEntry> entries = shiftIds.isEmpty()
                ? List.of()
                : scheduleEntryRepository.findByShiftIdInAndStatusNot(shiftIds, ScheduleEntryStatus.CANCELLED);
        Map<UUID, List<ScheduleEntry>> entriesByShiftId = entries.stream()
                .collect(Collectors.groupingBy(ScheduleEntry::getShiftId));

        Set<UUID> userIds = entries.stream()
                .map(ScheduleEntry::getUserId)
                .collect(Collectors.toSet());
        Map<UUID, String> userDisplayNames = userDirectoryClient.getDisplayNamesByUserIds(userIds);
        Map<UUID, String> clientCompanyNames = loadClientCompanyNames(companyId, events);

        return events.stream()
                .map(event -> mapEventHierarchy(event, shiftsByEventId, entriesByShiftId, userDisplayNames, clientCompanyNames))
                .toList();
    }

    private List<Event> resolveEvents(UUID companyId, UUID eventFilterId) {
        if (eventFilterId == null) {
            return eventRepository.findByCompanyIdOrderByStartDateAsc(companyId);
        }
        return eventRepository.findByEventIdAndCompanyId(eventFilterId, companyId)
                .map(List::of)
                .orElse(List.of());
    }

    private PlanningViewResponseDTO mapEventHierarchy(
            Event event,
            Map<UUID, List<Shift>> shiftsByEventId,
            Map<UUID, List<ScheduleEntry>> entriesByShiftId,
            Map<UUID, String> userDisplayNames,
            Map<UUID, String> clientCompanyNames) {
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
            int assignedCount = shiftEntries.size();
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
            shiftDto.setStaffingStatus(resolveStaffingStatus(assignedCount, peopleNeeded));
            shiftDto.setAllocations(shiftEntries.stream()
                    .map(entry -> mapAllocation(shift, entry, userDisplayNames))
                    .sorted(Comparator.comparing(PlanningResourceAllocationDTO::getStartTime))
                    .toList());
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
                    day.setAllocations(dayShifts.stream()
                            .flatMap(shift -> shift.getAllocations().stream())
                            .sorted(Comparator.comparing(PlanningResourceAllocationDTO::getStartTime))
                            .toList());
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
        return clientCompanyRepository.findByOwnerCompanyIdOrderByNameAsc(companyId).stream()
                .filter(clientCompany -> clientCompanyIds.contains(clientCompany.getClientCompanyId()))
                .collect(Collectors.toMap(ClientCompany::getClientCompanyId, ClientCompany::getName));
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
}
