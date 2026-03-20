package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningAssignmentMutationResponseDTO;
import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.dto.PlanningClientCompanyDTO;
import com.pm.planningservice.dto.PlanningClientCompanyContactDTO;
import com.pm.planningservice.dto.PlanningClientCompanyContactSaveRequestDTO;
import com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO;
import com.pm.planningservice.dto.PlanningEventMutationResponseDTO;
import com.pm.planningservice.dto.PlanningEventSaveRequestDTO;
import com.pm.planningservice.dto.PlanningShiftMutationResponseDTO;
import com.pm.planningservice.dto.PlanningShiftSaveRequestDTO;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.ClientCompanyContact;
import com.pm.planningservice.model.Event;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.EventRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class PlanningManagementService {
    private static final String DEFAULT_EVENT_STATUS = "DRAFT";

    private final ClientCompanyRepository clientCompanyRepository;
    private final EventRepository eventRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;

    public PlanningManagementService(
            ClientCompanyRepository clientCompanyRepository,
            EventRepository eventRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository
    ) {
        this.clientCompanyRepository = clientCompanyRepository;
        this.eventRepository = eventRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
    }

    @Transactional
    public PlanningClientCompanyDTO createClientCompany(UUID companyId, PlanningClientCompanySaveRequestDTO request) {
        String name = normalizeRequiredText(request.getName(), "Client company name is required");
        if (clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCase(companyId, name)) {
            throw new IllegalArgumentException("A client company with this name already exists");
        }

        ClientCompany clientCompany = new ClientCompany();
        clientCompany.setOwnerCompanyId(companyId);
        clientCompany.setName(name);
        clientCompany.setAddress(normalizeOptionalText(request.getAddress()));
        clientCompany.setCompanyLine(normalizeOptionalText(request.getCompanyLine()));
        clientCompany.setNotes(normalizeOptionalText(request.getNotes()));
        clientCompany.setContacts(normalizeContacts(request.getContacts()));
        clientCompany.setCreatedAt(LocalDateTime.now());
        return toClientCompanyDto(clientCompanyRepository.save(clientCompany));
    }

    public List<PlanningClientCompanyDTO> listClientCompanies(UUID companyId) {
        return clientCompanyRepository.findByOwnerCompanyIdOrderByNameAsc(companyId).stream()
                .map(this::toClientCompanyDto)
                .toList();
    }

    @Transactional
    public PlanningEventMutationResponseDTO createEvent(UUID companyId, UUID userId, PlanningEventSaveRequestDTO request) {
        validateEventRequest(companyId, request);

        Event event = new Event();
        event.setCompanyId(companyId);
        event.setClientCompanyId(resolveClientCompanyId(companyId, request.getClientCompanyId()));
        event.setName(normalizeRequiredText(request.getName(), "Event name is required"));
        event.setStartDate(request.getStartDate());
        event.setEndDate(request.getEndDate());
        event.setInternalDescription(normalizeOptionalText(request.getInternalDescription()));
        event.setExternalDescription(normalizeOptionalText(request.getExternalDescription()));
        event.setDefaultStartTime(request.getDefaultStartTime());
        event.setDefaultEndTime(request.getDefaultEndTime());
        event.setLocation(normalizeOptionalText(request.getLocation()));
        event.setStatus(normalizeEventStatus(request.getStatus()));
        event.setCreatedByUserId(userId);
        event.setCreatedAt(LocalDateTime.now());
        event.setUpdatedAt(LocalDateTime.now());
        event.setFinalized(false);
        event.setFinalizedAt(null);

        Event saved = eventRepository.save(event);
        PlanningEventMutationResponseDTO response = new PlanningEventMutationResponseDTO();
        response.setEventId(saved.getEventId());
        return response;
    }

    @Transactional
    public PlanningEventMutationResponseDTO updateEvent(UUID companyId, UUID eventId, PlanningEventSaveRequestDTO request) {
        validateEventRequest(companyId, request);

        Event event = requireEditableEvent(companyId, eventId);
        List<Shift> existingShifts = shiftRepository.findByEventId(eventId);
        boolean hasOutOfRangeShift = existingShifts.stream()
                .anyMatch(shift -> !isWithinEventRange(shift.getStartTime(), shift.getEndTime(), request.getStartDate(), request.getEndDate()));
        if (hasOutOfRangeShift) {
            throw new IllegalArgumentException("Existing shifts fall outside the new event date range");
        }

        event.setClientCompanyId(resolveClientCompanyId(companyId, request.getClientCompanyId()));
        event.setName(normalizeRequiredText(request.getName(), "Event name is required"));
        event.setStartDate(request.getStartDate());
        event.setEndDate(request.getEndDate());
        event.setInternalDescription(normalizeOptionalText(request.getInternalDescription()));
        event.setExternalDescription(normalizeOptionalText(request.getExternalDescription()));
        event.setDefaultStartTime(request.getDefaultStartTime());
        event.setDefaultEndTime(request.getDefaultEndTime());
        event.setLocation(normalizeOptionalText(request.getLocation()));
        event.setStatus(normalizeEventStatus(request.getStatus()));
        event.setUpdatedAt(LocalDateTime.now());
        eventRepository.save(event);

        PlanningEventMutationResponseDTO response = new PlanningEventMutationResponseDTO();
        response.setEventId(event.getEventId());
        return response;
    }

    @Transactional
    public void deleteEvent(UUID companyId, UUID eventId) {
        Event event = requireEditableEvent(companyId, eventId);
        List<Shift> shifts = shiftRepository.findByEventId(eventId);
        deleteShiftChildren(shifts);
        shiftRepository.deleteAll(shifts);
        eventRepository.delete(event);
    }

    @Transactional
    public PlanningShiftMutationResponseDTO createShift(UUID companyId, UUID eventId, PlanningShiftSaveRequestDTO request) {
        Event event = requireEditableEvent(companyId, eventId);
        validateShift(event, request);

        Shift shift = new Shift();
        shift.setEventId(event.getEventId());
        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        shift.setName(normalizeOptionalText(request.getName()));
        shift.setBreakMinutes(resolveBreakMinutes(request.getBreakMinutes()));
        shift.setLocation(normalizeOptionalText(request.getLocation()));
        shift.setPeopleNeeded(resolvePeopleNeeded(request.getPeopleNeeded()));
        shift.setFunctionName(normalizeRequiredText(request.getFunctionName(), "Job function is required"));

        Shift saved = shiftRepository.save(shift);
        PlanningShiftMutationResponseDTO response = new PlanningShiftMutationResponseDTO();
        response.setShiftId(saved.getShiftId());
        response.setEventId(event.getEventId());
        return response;
    }

    @Transactional
    public PlanningShiftMutationResponseDTO updateShift(UUID companyId, UUID shiftId, PlanningShiftSaveRequestDTO request) {
        Shift shift = requireShift(shiftId);
        Event event = requireEditableEvent(companyId, shift.getEventId());
        validateShift(event, request);

        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        shift.setName(normalizeOptionalText(request.getName()));
        shift.setBreakMinutes(resolveBreakMinutes(request.getBreakMinutes()));
        shift.setLocation(normalizeOptionalText(request.getLocation()));
        shift.setPeopleNeeded(resolvePeopleNeeded(request.getPeopleNeeded()));
        shift.setFunctionName(normalizeRequiredText(request.getFunctionName(), "Job function is required"));
        shiftRepository.save(shift);

        PlanningShiftMutationResponseDTO response = new PlanningShiftMutationResponseDTO();
        response.setShiftId(shift.getShiftId());
        response.setEventId(event.getEventId());
        return response;
    }

    @Transactional
    public void deleteShift(UUID companyId, UUID shiftId) {
        Shift shift = requireShift(shiftId);
        requireEditableEvent(companyId, shift.getEventId());
        deleteShiftChildren(List.of(shift));
        shiftRepository.delete(shift);
    }

    @Transactional
    public PlanningAssignmentMutationResponseDTO createAssignment(
            UUID companyId,
            UUID shiftId,
            PlanningAssignmentSaveRequestDTO request
    ) {
        Shift shift = requireShift(shiftId);
        requireEditableEvent(companyId, shift.getEventId());
        ensureAssignmentAbsent(shiftId, request.getUserId(), null);

        ScheduleEntry scheduleEntry = new ScheduleEntry();
        scheduleEntry.setShiftId(shiftId);
        scheduleEntry.setUserId(request.getUserId());
        scheduleEntry.setStatus(resolveStatus(request.getStatus()));
        ScheduleEntry saved = scheduleEntryRepository.save(scheduleEntry);

        PlanningAssignmentMutationResponseDTO response = new PlanningAssignmentMutationResponseDTO();
        response.setScheduleEntryId(saved.getScheduleEntryId());
        response.setShiftId(shift.getShiftId());
        return response;
    }

    @Transactional
    public PlanningAssignmentMutationResponseDTO updateAssignment(
            UUID companyId,
            UUID scheduleEntryId,
            PlanningAssignmentSaveRequestDTO request
    ) {
        ScheduleEntry scheduleEntry = requireScheduleEntry(scheduleEntryId);
        Shift shift = requireShift(scheduleEntry.getShiftId());
        requireEditableEvent(companyId, shift.getEventId());
        ensureAssignmentAbsent(shift.getShiftId(), request.getUserId(), scheduleEntry.getScheduleEntryId());

        scheduleEntry.setUserId(request.getUserId());
        scheduleEntry.setStatus(resolveStatus(request.getStatus()));
        scheduleEntryRepository.save(scheduleEntry);

        PlanningAssignmentMutationResponseDTO response = new PlanningAssignmentMutationResponseDTO();
        response.setScheduleEntryId(scheduleEntry.getScheduleEntryId());
        response.setShiftId(shift.getShiftId());
        return response;
    }

    @Transactional
    public void deleteAssignment(UUID companyId, UUID scheduleEntryId) {
        ScheduleEntry scheduleEntry = requireScheduleEntry(scheduleEntryId);
        Shift shift = requireShift(scheduleEntry.getShiftId());
        requireEditableEvent(companyId, shift.getEventId());
        scheduleEntryRepository.delete(scheduleEntry);
    }

    private Event requireEditableEvent(UUID companyId, UUID eventId) {
        Event event = eventRepository.findByEventIdAndCompanyId(eventId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Planning event not found"));
        if (Boolean.TRUE.equals(event.getFinalized())) {
            throw new IllegalArgumentException("Finalized events can no longer be changed");
        }
        return event;
    }

    private Shift requireShift(UUID shiftId) {
        return shiftRepository.findById(shiftId)
                .orElseThrow(() -> new IllegalArgumentException("Shift not found"));
    }

    private ScheduleEntry requireScheduleEntry(UUID scheduleEntryId) {
        return scheduleEntryRepository.findById(scheduleEntryId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
    }

    private void validateEventRequest(UUID companyId, PlanningEventSaveRequestDTO request) {
        validateEventDates(request.getStartDate(), request.getEndDate());
        validateDefaultTimes(request.getDefaultStartTime(), request.getDefaultEndTime());
        if (request.getClientCompanyId() != null) {
            resolveClientCompanyId(companyId, request.getClientCompanyId());
        }
    }

    private void validateEventDates(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Event start and end dates are required");
        }
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Event end date cannot be before the start date");
        }
    }

    private void validateDefaultTimes(java.time.LocalTime defaultStartTime, java.time.LocalTime defaultEndTime) {
        if (defaultStartTime == null && defaultEndTime == null) {
            return;
        }
        if (defaultStartTime == null || defaultEndTime == null) {
            throw new IllegalArgumentException("Default start and end time must both be provided");
        }
        if (!defaultEndTime.isAfter(defaultStartTime)) {
            throw new IllegalArgumentException("Default event end time must be after the start time");
        }
    }

    private void validateShift(Event event, PlanningShiftSaveRequestDTO request) {
        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = request.getEndTime();
        if (startTime == null || endTime == null) {
            throw new IllegalArgumentException("Shift start and end times are required");
        }
        if (request.getFunctionName() == null || request.getFunctionName().trim().isEmpty()) {
            throw new IllegalArgumentException("Job function is required");
        }
        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("Shift end time must be after the start time");
        }
        if (resolveBreakMinutes(request.getBreakMinutes()) < 0) {
            throw new IllegalArgumentException("Break time cannot be negative");
        }
        if (resolvePeopleNeeded(request.getPeopleNeeded()) < 1) {
            throw new IllegalArgumentException("At least one person is required per shift");
        }
        if (!isWithinEventRange(startTime, endTime, event.getStartDate(), event.getEndDate())) {
            throw new IllegalArgumentException("Shift must stay within the selected event date range");
        }
    }

    private boolean isWithinEventRange(
            LocalDateTime startTime,
            LocalDateTime endTime,
            LocalDate startDate,
            LocalDate endDate
    ) {
        LocalDate shiftStartDate = startTime.toLocalDate();
        LocalDate shiftEndDate = endTime.toLocalDate();
        return !shiftStartDate.isBefore(startDate) && !shiftEndDate.isAfter(endDate);
    }

    private void ensureAssignmentAbsent(UUID shiftId, UUID userId, UUID currentScheduleEntryId) {
        boolean duplicate = scheduleEntryRepository.findByShiftId(shiftId).stream()
                .anyMatch(entry -> userId.equals(entry.getUserId())
                        && (currentScheduleEntryId == null || !currentScheduleEntryId.equals(entry.getScheduleEntryId())));
        if (duplicate) {
            throw new IllegalArgumentException("This employee is already assigned to the selected shift");
        }
    }

    private ScheduleEntryStatus resolveStatus(ScheduleEntryStatus status) {
        return status == null ? ScheduleEntryStatus.ASSIGNED : status;
    }

    private PlanningClientCompanyDTO toClientCompanyDto(ClientCompany clientCompany) {
        PlanningClientCompanyDTO dto = new PlanningClientCompanyDTO();
        dto.setClientCompanyId(clientCompany.getClientCompanyId());
        dto.setName(clientCompany.getName());
        dto.setAddress(clientCompany.getAddress());
        dto.setCompanyLine(clientCompany.getCompanyLine());
        dto.setNotes(clientCompany.getNotes());
        dto.setContacts(clientCompany.getContacts().stream()
                .map(this::toClientCompanyContactDto)
                .toList());
        dto.setCreatedAt(clientCompany.getCreatedAt());
        return dto;
    }

    private PlanningClientCompanyContactDTO toClientCompanyContactDto(ClientCompanyContact contact) {
        PlanningClientCompanyContactDTO dto = new PlanningClientCompanyContactDTO();
        dto.setFirstName(contact.getFirstName());
        dto.setLastName(contact.getLastName());
        dto.setPosition(contact.getPosition());
        dto.setEmail(contact.getEmail());
        dto.setPhone(contact.getPhone());
        return dto;
    }

    private List<ClientCompanyContact> normalizeContacts(List<PlanningClientCompanyContactSaveRequestDTO> contacts) {
        if (contacts == null || contacts.isEmpty()) {
            return List.of();
        }

        return contacts.stream()
                .map(this::normalizeContact)
                .filter(Objects::nonNull)
                .toList();
    }

    private ClientCompanyContact normalizeContact(PlanningClientCompanyContactSaveRequestDTO request) {
        if (request == null) {
            return null;
        }

        String firstName = normalizeOptionalText(request.getFirstName());
        String lastName = normalizeOptionalText(request.getLastName());
        String position = normalizeOptionalText(request.getPosition());
        String email = normalizeOptionalText(request.getEmail());
        String phone = normalizeOptionalText(request.getPhone());

        if (firstName == null && lastName == null && position == null && email == null && phone == null) {
            return null;
        }

        ClientCompanyContact contact = new ClientCompanyContact();
        contact.setFirstName(firstName);
        contact.setLastName(lastName);
        contact.setPosition(position);
        contact.setEmail(email);
        contact.setPhone(phone);
        return contact;
    }

    private UUID resolveClientCompanyId(UUID companyId, UUID clientCompanyId) {
        if (clientCompanyId == null) {
            return null;
        }
        return clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId)
                .map(ClientCompany::getClientCompanyId)
                .orElseThrow(() -> new IllegalArgumentException("Selected client company was not found"));
    }

    private String normalizeRequiredText(String value, String message) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeEventStatus(String value) {
        if (value == null || value.trim().isEmpty()) {
            return DEFAULT_EVENT_STATUS;
        }
        return value.trim().toUpperCase();
    }

    private int resolveBreakMinutes(Integer value) {
        return value == null ? 0 : value;
    }

    private int resolvePeopleNeeded(Integer value) {
        return value == null ? 1 : value;
    }

    private void deleteShiftChildren(List<Shift> shifts) {
        List<UUID> shiftIds = shifts.stream().map(Shift::getShiftId).toList();
        if (shiftIds.isEmpty()) {
            return;
        }
        List<ScheduleEntry> scheduleEntries = scheduleEntryRepository.findByShiftIdIn(shiftIds);
        if (!scheduleEntries.isEmpty()) {
            scheduleEntryRepository.deleteAll(scheduleEntries);
        }
    }
}
