package com.pm.planningservice.service;

import com.pm.planningservice.dto.AuditLogCreateRequestDTO;
import com.pm.planningservice.dto.AuditLogMessagePartDTO;
import com.pm.planningservice.dto.PlanningAssignmentMutationResponseDTO;
import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.dto.PlanningClientCompanyDTO;
import com.pm.planningservice.dto.PlanningClientCompanyContactDTO;
import com.pm.planningservice.dto.PlanningClientCompanyContactSaveRequestDTO;
import com.pm.planningservice.dto.PlanningClientCompanySaveRequestDTO;
import com.pm.planningservice.dto.PlanningLocationDTO;
import com.pm.planningservice.dto.PlanningLocationSaveRequestDTO;
import com.pm.planningservice.dto.PagedResponseDTO;
import com.pm.planningservice.dto.PlanningProjectMutationResponseDTO;
import com.pm.planningservice.dto.PlanningProjectSaveRequestDTO;
import com.pm.planningservice.dto.PlanningShiftMutationResponseDTO;
import com.pm.planningservice.dto.PlanningShiftSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.ClientCompanyContact;
import com.pm.planningservice.model.ClientFunctionBillingRate;
import com.pm.planningservice.model.PlanningClientLocationUsage;
import com.pm.planningservice.model.PlanningLocation;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ProjectFunctionBillingRate;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.PlanningClientLocationUsageRepository;
import com.pm.planningservice.repository.PlanningLocationRepository;
import com.pm.planningservice.repository.ProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PlanningManagementService {
    private static final Logger log = LoggerFactory.getLogger(PlanningManagementService.class);
    private static final String DEFAULT_PROJECT_STATUS = "DRAFT";
    private static final int MAX_CLIENT_PROFILE_PICTURE_LENGTH = 800_000;

    private final ClientCompanyRepository clientCompanyRepository;
    private final PlanningLocationRepository planningLocationRepository;
    private final PlanningClientLocationUsageRepository planningClientLocationUsageRepository;
    private final ProjectRepository projectRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;
    private final ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;
    @Autowired(required = false)
    private AuditLogClient auditLogClient;

    public PlanningManagementService(
            ClientCompanyRepository clientCompanyRepository,
            PlanningLocationRepository planningLocationRepository,
            PlanningClientLocationUsageRepository planningClientLocationUsageRepository,
            ProjectRepository projectRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            ClientFunctionBillingRateRepository clientFunctionBillingRateRepository,
            ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository
    ) {
        this.clientCompanyRepository = clientCompanyRepository;
        this.planningLocationRepository = planningLocationRepository;
        this.planningClientLocationUsageRepository = planningClientLocationUsageRepository;
        this.projectRepository = projectRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.clientFunctionBillingRateRepository = clientFunctionBillingRateRepository;
        this.projectFunctionBillingRateRepository = projectFunctionBillingRateRepository;
    }

    @Transactional
    public PlanningClientCompanyDTO createClientCompany(UUID companyId, PlanningClientCompanySaveRequestDTO request) {
        return createClientCompany(companyId, request, null);
    }

    @Transactional
    public PlanningClientCompanyDTO createClientCompany(UUID companyId, PlanningClientCompanySaveRequestDTO request, String accessToken) {
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
        clientCompany.setProfilePictureUrl(normalizeClientProfilePicture(request.getProfilePictureUrl()));
        clientCompany.setContacts(normalizeContacts(request.getContacts()));
        clientCompany.setCreatedAt(LocalDateTime.now());
        ClientCompany saved = clientCompanyRepository.save(clientCompany);
        recordAudit(
                accessToken,
                "CLIENTS",
                "CREATED",
                "CLIENT_COMPANY",
                saved.getClientCompanyId(),
                List.of(textPart(" created client "), clientLink(saved))
        );
        return toClientCompanyDto(saved);
    }

    @Transactional
    public PlanningClientCompanyDTO updateClientCompany(
            UUID companyId,
            UUID clientCompanyId,
            PlanningClientCompanySaveRequestDTO request
    ) {
        return updateClientCompany(companyId, clientCompanyId, request, null);
    }

    @Transactional
    public PlanningClientCompanyDTO updateClientCompany(
            UUID companyId,
            UUID clientCompanyId,
            PlanningClientCompanySaveRequestDTO request,
            String accessToken
    ) {
        ClientCompany clientCompany = clientCompanyRepository
                .findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Client company not found"));

        String name = normalizeRequiredText(request.getName(), "Client company name is required");
        if (clientCompanyRepository.existsByOwnerCompanyIdAndNameIgnoreCaseAndClientCompanyIdNot(
                companyId,
                name,
                clientCompanyId
        )) {
            throw new IllegalArgumentException("A client company with this name already exists");
        }

        clientCompany.setName(name);
        clientCompany.setAddress(normalizeOptionalText(request.getAddress()));
        clientCompany.setCompanyLine(normalizeOptionalText(request.getCompanyLine()));
        clientCompany.setNotes(normalizeOptionalText(request.getNotes()));
        clientCompany.setProfilePictureUrl(normalizeClientProfilePicture(request.getProfilePictureUrl()));
        clientCompany.setContacts(normalizeContacts(request.getContacts()));
        ClientCompany saved = clientCompanyRepository.save(clientCompany);
        recordAudit(
                accessToken,
                "CLIENTS",
                "UPDATED",
                "CLIENT_COMPANY",
                saved.getClientCompanyId(),
                List.of(textPart(" updated client "), clientLink(saved))
        );
        return toClientCompanyDto(saved);
    }

    @Transactional(readOnly = true)
    public List<PlanningClientCompanyDTO> listClientCompanies(UUID companyId) {
        return clientCompanyRepository.findByOwnerCompanyIdOrderByNameAsc(companyId).stream()
                .map(this::toClientCompanyDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponseDTO<PlanningClientCompanyDTO> listClientCompaniesPage(UUID companyId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "name", "createdAt"));
        var companies = clientCompanyRepository.findByOwnerCompanyId(companyId, pageable);
        return PagedResponseDTO.from(companies, this::toClientCompanyDto);
    }

    @Transactional(readOnly = true)
    public List<PlanningLocationDTO> listLocations(UUID companyId, UUID clientCompanyId) {
        List<PlanningLocation> locations = planningLocationRepository.findByOwnerCompanyIdOrderByNameAsc(companyId);
        if (locations.isEmpty()) {
            return List.of();
        }

        List<UUID> locationIds = locations.stream().map(PlanningLocation::getLocationId).toList();
        Map<UUID, List<PlanningClientLocationUsage>> usagesByLocationId =
                planningClientLocationUsageRepository.findByLocationIdIn(locationIds).stream()
                        .collect(Collectors.groupingBy(PlanningClientLocationUsage::getLocationId));

        Map<UUID, PlanningClientLocationUsage> usageByLocationId;
        if (clientCompanyId != null) {
            requireClientCompany(companyId, clientCompanyId);
            usageByLocationId = planningClientLocationUsageRepository.findByClientCompanyIdAndLocationIdIn(
                            clientCompanyId,
                            locationIds
                    ).stream()
                    .collect(Collectors.toMap(PlanningClientLocationUsage::getLocationId, Function.identity()));
        } else {
            usageByLocationId = Map.of();
        }

        return locations.stream()
                .sorted(Comparator
                        .comparing((PlanningLocation location) -> {
                            PlanningClientLocationUsage usage = usageByLocationId.get(location.getLocationId());
                            return usage != null && usage.isManuallyPrioritized();
                        }).reversed()
                        .thenComparing(Comparator.comparing((PlanningLocation location) -> {
                                PlanningClientLocationUsage usage = usageByLocationId.get(location.getLocationId());
                                return usage != null && usage.getLastUsedAt() != null;
                            }).reversed())
                        .thenComparing(
                                (PlanningLocation location) -> {
                                    PlanningClientLocationUsage usage = usageByLocationId.get(location.getLocationId());
                                    return usage == null ? null : usage.getLastUsedAt();
                                },
                                Comparator.nullsLast(Comparator.reverseOrder())
                        )
                        .thenComparing(PlanningLocation::getName, String.CASE_INSENSITIVE_ORDER))
                .map(location -> toLocationDto(
                        location,
                        usageByLocationId.get(location.getLocationId()),
                        usagesByLocationId.getOrDefault(location.getLocationId(), List.of())
                ))
                .toList();
    }

    @Transactional
    public PlanningLocationDTO createLocation(UUID companyId, PlanningLocationSaveRequestDTO request) {
        return createLocation(companyId, request, null);
    }

    @Transactional
    public PlanningLocationDTO createLocation(UUID companyId, PlanningLocationSaveRequestDTO request, String accessToken) {
        String name = normalizeRequiredText(request.getName(), "Location name is required");
        if (planningLocationRepository.existsByOwnerCompanyIdAndNameIgnoreCase(companyId, name)) {
            throw new IllegalArgumentException("A saved location with this name already exists");
        }

        PlanningLocation location = new PlanningLocation();
        location.setOwnerCompanyId(companyId);
        location.setName(name);
        location.setStreetName(normalizeOptionalText(request.getStreetName()));
        location.setHouseNumber(normalizeOptionalText(request.getHouseNumber()));
        location.setHouseNumberSuffix(normalizeOptionalText(request.getHouseNumberSuffix()));
        location.setPostalCode(normalizeOptionalText(request.getPostalCode()));
        location.setCity(normalizeOptionalText(request.getCity()));
        location.setNotes(normalizeOptionalText(request.getNotes()));
        PlanningLocation saved = planningLocationRepository.save(location);
        List<PlanningClientLocationUsage> usages = syncManualLocationPriorities(
                companyId,
                request.getPrioritizedClientCompanyIds(),
                saved
        );
        recordAudit(
                accessToken,
                "PLANNING",
                "CREATED",
                "PLANNING_LOCATION",
                saved.getLocationId(),
                List.of(textPart(" created saved location "), locationLink(saved))
        );
        return toLocationDto(saved, null, usages);
    }

    @Transactional
    public PlanningLocationDTO updateLocation(UUID companyId, UUID locationId, PlanningLocationSaveRequestDTO request) {
        return updateLocation(companyId, locationId, request, null);
    }

    @Transactional
    public PlanningLocationDTO updateLocation(UUID companyId, UUID locationId, PlanningLocationSaveRequestDTO request, String accessToken) {
        PlanningLocation location = requireLocation(companyId, locationId);
        String name = normalizeRequiredText(request.getName(), "Location name is required");
        if (planningLocationRepository.existsByOwnerCompanyIdAndNameIgnoreCaseAndLocationIdNot(companyId, name, locationId)) {
            throw new IllegalArgumentException("A saved location with this name already exists");
        }

        location.setName(name);
        location.setStreetName(normalizeOptionalText(request.getStreetName()));
        location.setHouseNumber(normalizeOptionalText(request.getHouseNumber()));
        location.setHouseNumberSuffix(normalizeOptionalText(request.getHouseNumberSuffix()));
        location.setPostalCode(normalizeOptionalText(request.getPostalCode()));
        location.setCity(normalizeOptionalText(request.getCity()));
        location.setNotes(normalizeOptionalText(request.getNotes()));
        PlanningLocation saved = planningLocationRepository.save(location);
        List<PlanningClientLocationUsage> usages = syncManualLocationPriorities(
                companyId,
                request.getPrioritizedClientCompanyIds(),
                saved
        );
        recordAudit(
                accessToken,
                "PLANNING",
                "UPDATED",
                "PLANNING_LOCATION",
                saved.getLocationId(),
                List.of(textPart(" updated saved location "), locationLink(saved))
        );
        return toLocationDto(saved, null, usages);
    }

    @Transactional
    public void deleteLocation(UUID companyId, UUID locationId) {
        deleteLocation(companyId, locationId, null);
    }

    @Transactional
    public void deleteLocation(UUID companyId, UUID locationId, String accessToken) {
        PlanningLocation location = requireLocation(companyId, locationId);
        planningClientLocationUsageRepository.deleteByLocationId(location.getLocationId());
        planningLocationRepository.delete(location);
        recordAudit(
                accessToken,
                "PLANNING",
                "DELETED",
                "PLANNING_LOCATION",
                location.getLocationId(),
                List.of(textPart(" deleted saved location "), locationLink(location))
        );
    }

    @Transactional
    public PlanningProjectMutationResponseDTO createProject(UUID companyId, UUID userId, PlanningProjectSaveRequestDTO request) {
        return createProject(companyId, userId, request, null);
    }

    @Transactional
    public PlanningProjectMutationResponseDTO createProject(
            UUID companyId,
            UUID userId,
            PlanningProjectSaveRequestDTO request,
            String accessToken
    ) {
        validateProjectRequest(companyId, request);
        PlanningLocation savedLocation = resolveSavedLocation(companyId, request.getSavedLocationId());

        Project project = new Project();
        project.setCompanyId(companyId);
        project.setClientCompanyId(resolveClientCompanyId(companyId, request.getClientCompanyId()));
        project.setName(normalizeRequiredText(request.getName(), "Project name is required"));
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setInternalDescription(normalizeOptionalText(request.getInternalDescription()));
        project.setExternalDescription(normalizeOptionalText(request.getExternalDescription()));
        project.setDefaultStartTime(request.getDefaultStartTime());
        project.setDefaultEndTime(request.getDefaultEndTime());
        project.setProjectTimezone(PlanningTimeZoneSupport.normalizeProjectTimezone(request.getProjectTimezone()));
        project.setLocation(resolveLocationValue(request.getLocation(), savedLocation));
        project.setStatus(normalizeProjectStatus(request.getStatus()));
        project.setCreatedByUserId(userId);
        project.setCreatedAt(LocalDateTime.now());
        project.setUpdatedAt(LocalDateTime.now());
        project.setFinalized(false);
        project.setFinalizedAt(null);

        Project saved = projectRepository.save(project);
        copyClientBillingRatesToProject(companyId, saved, userId);
        touchLocationUsage(companyId, saved.getClientCompanyId(), savedLocation);
        PlanningProjectMutationResponseDTO response = new PlanningProjectMutationResponseDTO();
        response.setProjectId(saved.getProjectId());
        recordAudit(
                accessToken,
                "PLANNING",
                "CREATED",
                "PROJECT",
                saved.getProjectId(),
                List.of(textPart(" created project "), projectLink(saved))
        );
        return response;
    }

    private void copyClientBillingRatesToProject(UUID companyId, Project project, UUID userId) {
        if (project.getClientCompanyId() == null) {
            return;
        }
        List<ClientFunctionBillingRate> activeRates =
                clientFunctionBillingRateRepository.findByCompanyIdAndClientCompanyIdAndActiveTrueOrderByFunctionNameAsc(
                        companyId,
                        project.getClientCompanyId()
                );
        LocalDateTime now = LocalDateTime.now();
        for (ClientFunctionBillingRate activeRate : activeRates) {
            ProjectFunctionBillingRate projectRate = new ProjectFunctionBillingRate();
            projectRate.setCompanyId(companyId);
            projectRate.setClientCompanyId(project.getClientCompanyId());
            projectRate.setProjectId(project.getProjectId());
            projectRate.setFunctionName(activeRate.getFunctionName());
            projectRate.setRatePerHour(activeRate.getRatePerHour());
            projectRate.setSourceClientFunctionBillingRateId(activeRate.getClientFunctionBillingRateId());
            projectRate.setCopiedAt(now);
            projectRate.setNotes(activeRate.getNotes());
            projectRate.setCreatedAt(now);
            projectRate.setUpdatedAt(now);
            projectRate.setCreatedByUserId(userId);
            projectRate.setUpdatedByUserId(userId);
            projectFunctionBillingRateRepository.save(projectRate);
        }
    }

    @Transactional
    public PlanningProjectMutationResponseDTO updateProject(UUID companyId, UUID projectId, PlanningProjectSaveRequestDTO request) {
        return updateProject(companyId, projectId, request, null);
    }

    @Transactional
    public PlanningProjectMutationResponseDTO updateProject(
            UUID companyId,
            UUID projectId,
            PlanningProjectSaveRequestDTO request,
            String accessToken
    ) {
        validateProjectRequest(companyId, request);
        PlanningLocation savedLocation = resolveSavedLocation(companyId, request.getSavedLocationId());

        Project project = requireEditableProject(companyId, projectId);
        List<Shift> existingShifts = shiftRepository.findByProjectId(projectId);
        boolean hasOutOfRangeShift = existingShifts.stream()
                .anyMatch(shift -> !isWithinProjectRange(shift.getStartTime(), shift.getEndTime(), request.getStartDate(), request.getEndDate()));
        if (hasOutOfRangeShift) {
            throw new IllegalArgumentException("Existing shifts fall outside the new project date range");
        }

        project.setClientCompanyId(resolveClientCompanyId(companyId, request.getClientCompanyId()));
        project.setName(normalizeRequiredText(request.getName(), "Project name is required"));
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setInternalDescription(normalizeOptionalText(request.getInternalDescription()));
        project.setExternalDescription(normalizeOptionalText(request.getExternalDescription()));
        project.setDefaultStartTime(request.getDefaultStartTime());
        project.setDefaultEndTime(request.getDefaultEndTime());
        project.setProjectTimezone(PlanningTimeZoneSupport.normalizeProjectTimezone(request.getProjectTimezone()));
        project.setLocation(resolveLocationValue(request.getLocation(), savedLocation));
        project.setStatus(normalizeProjectStatus(request.getStatus()));
        project.setUpdatedAt(LocalDateTime.now());
        projectRepository.save(project);
        touchLocationUsage(companyId, project.getClientCompanyId(), savedLocation);

        PlanningProjectMutationResponseDTO response = new PlanningProjectMutationResponseDTO();
        response.setProjectId(project.getProjectId());
        recordAudit(
                accessToken,
                "PLANNING",
                "UPDATED",
                "PROJECT",
                project.getProjectId(),
                List.of(textPart(" updated project "), projectLink(project))
        );
        return response;
    }

    @Transactional
    public void deleteProject(UUID companyId, UUID projectId) {
        deleteProject(companyId, projectId, null);
    }

    @Transactional
    public void deleteProject(UUID companyId, UUID projectId, String accessToken) {
        Project project = requireEditableProject(companyId, projectId);
        List<Shift> shifts = shiftRepository.findByProjectId(projectId);
        deleteShiftChildren(shifts);
        shiftRepository.deleteAll(shifts);
        projectRepository.delete(project);
        recordAudit(
                accessToken,
                "PLANNING",
                "DELETED",
                "PROJECT",
                project.getProjectId(),
                List.of(textPart(" deleted project "), projectLink(project))
        );
    }

    @Transactional
    public PlanningShiftMutationResponseDTO createShift(UUID companyId, UUID projectId, PlanningShiftSaveRequestDTO request) {
        return createShift(companyId, projectId, request, null);
    }

    @Transactional
    public PlanningShiftMutationResponseDTO createShift(
            UUID companyId,
            UUID projectId,
            PlanningShiftSaveRequestDTO request,
            String accessToken
    ) {
        Project project = requireEditableProject(companyId, projectId);
        validateShift(project, request);
        PlanningLocation savedLocation = resolveSavedLocation(companyId, request.getSavedLocationId());

        Shift shift = new Shift();
        shift.setProjectId(project.getProjectId());
        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        shift.setName(normalizeOptionalText(request.getName()));
        shift.setBreakMinutes(resolveBreakMinutes(request.getBreakMinutes()));
        shift.setLocation(resolveLocationValue(request.getLocation(), savedLocation));
        shift.setPeopleNeeded(resolvePeopleNeeded(request.getPeopleNeeded()));
        shift.setFunctionName(normalizeRequiredText(request.getFunctionName(), "Job function is required"));

        Shift saved = shiftRepository.save(shift);
        touchLocationUsage(companyId, project.getClientCompanyId(), savedLocation);
        PlanningShiftMutationResponseDTO response = new PlanningShiftMutationResponseDTO();
        response.setShiftId(saved.getShiftId());
        response.setProjectId(project.getProjectId());
        recordAudit(
                accessToken,
                "PLANNING",
                "CREATED",
                "SHIFT",
                saved.getShiftId(),
                List.of(textPart(" created shift "), shiftLink(project, saved))
        );
        return response;
    }

    @Transactional
    public PlanningShiftMutationResponseDTO updateShift(UUID companyId, UUID shiftId, PlanningShiftSaveRequestDTO request) {
        return updateShift(companyId, shiftId, request, null);
    }

    @Transactional
    public PlanningShiftMutationResponseDTO updateShift(
            UUID companyId,
            UUID shiftId,
            PlanningShiftSaveRequestDTO request,
            String accessToken
    ) {
        Shift shift = requireShift(shiftId);
        Project project = requireEditableProject(companyId, shift.getProjectId());
        validateShift(project, request);
        PlanningLocation savedLocation = resolveSavedLocation(companyId, request.getSavedLocationId());

        shift.setStartTime(request.getStartTime());
        shift.setEndTime(request.getEndTime());
        shift.setName(normalizeOptionalText(request.getName()));
        shift.setBreakMinutes(resolveBreakMinutes(request.getBreakMinutes()));
        shift.setLocation(resolveLocationValue(request.getLocation(), savedLocation));
        shift.setPeopleNeeded(resolvePeopleNeeded(request.getPeopleNeeded()));
        shift.setFunctionName(normalizeRequiredText(request.getFunctionName(), "Job function is required"));
        shiftRepository.save(shift);
        touchLocationUsage(companyId, project.getClientCompanyId(), savedLocation);

        PlanningShiftMutationResponseDTO response = new PlanningShiftMutationResponseDTO();
        response.setShiftId(shift.getShiftId());
        response.setProjectId(project.getProjectId());
        recordAudit(
                accessToken,
                "PLANNING",
                "UPDATED",
                "SHIFT",
                shift.getShiftId(),
                List.of(textPart(" updated shift "), shiftLink(project, shift))
        );
        return response;
    }

    @Transactional
    public void deleteShift(UUID companyId, UUID shiftId) {
        deleteShift(companyId, shiftId, null);
    }

    @Transactional
    public void deleteShift(UUID companyId, UUID shiftId, String accessToken) {
        Shift shift = requireShift(shiftId);
        Project project = requireEditableProject(companyId, shift.getProjectId());
        deleteShiftChildren(List.of(shift));
        shiftRepository.delete(shift);
        recordAudit(
                accessToken,
                "PLANNING",
                "DELETED",
                "SHIFT",
                shift.getShiftId(),
                List.of(textPart(" deleted shift "), shiftLink(project, shift))
        );
    }

    @Transactional
    public PlanningAssignmentMutationResponseDTO createAssignment(
            UUID companyId,
            UUID shiftId,
            PlanningAssignmentSaveRequestDTO request
    ) {
        return createAssignment(companyId, shiftId, request, null);
    }

    @Transactional
    public PlanningAssignmentMutationResponseDTO createAssignment(
            UUID companyId,
            UUID shiftId,
            PlanningAssignmentSaveRequestDTO request,
            String accessToken
    ) {
        Shift shift = requireShift(shiftId);
        Project project = requireEditableProject(companyId, shift.getProjectId());
        UUID userId = Objects.requireNonNull(request.getUserId(), "User id is required");
        ScheduleEntryStatus requestedStatus = resolveStatus(request.getStatus());
        ScheduleEntry existingEntry = scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId).orElse(null);
        if (existingEntry != null) {
            existingEntry.setStatus(requestedStatus);
            existingEntry.setTimesheetExported(false);
            existingEntry.setTimesheetExportedAt(null);
            scheduleEntryRepository.save(existingEntry);
            recordAudit(
                    accessToken,
                    "PLANNING",
                    "ASSIGNED",
                    "ASSIGNMENT",
                    existingEntry.getScheduleEntryId(),
                    List.of(
                            textPart(" assigned "),
                            userLink(existingEntry.getUserId()),
                            textPart(" to "),
                            shiftLink(project, shift)
                    )
            );

            PlanningAssignmentMutationResponseDTO existingResponse = new PlanningAssignmentMutationResponseDTO();
            existingResponse.setScheduleEntryId(existingEntry.getScheduleEntryId());
            existingResponse.setShiftId(shift.getShiftId());
            return existingResponse;
        }

        ScheduleEntry scheduleEntry = new ScheduleEntry();
        scheduleEntry.setShiftId(shiftId);
        scheduleEntry.setUserId(userId);
        scheduleEntry.setStatus(requestedStatus);
        scheduleEntry.setTimesheetExported(false);
        scheduleEntry.setTimesheetExportedAt(null);
        ScheduleEntry saved = scheduleEntryRepository.save(scheduleEntry);
        recordAudit(
                accessToken,
                "PLANNING",
                "ASSIGNED",
                "ASSIGNMENT",
                saved.getScheduleEntryId(),
                List.of(
                        textPart(" assigned "),
                        userLink(saved.getUserId()),
                        textPart(" to "),
                        shiftLink(project, shift)
                )
        );

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
        return updateAssignment(companyId, scheduleEntryId, request, null);
    }

    @Transactional
    public PlanningAssignmentMutationResponseDTO updateAssignment(
            UUID companyId,
            UUID scheduleEntryId,
            PlanningAssignmentSaveRequestDTO request,
            String accessToken
    ) {
        ScheduleEntry scheduleEntry = requireScheduleEntry(scheduleEntryId);
        Shift shift = requireShift(scheduleEntry.getShiftId());
        Project project = requireEditableProject(companyId, shift.getProjectId());
        ensureAssignmentAbsent(shift.getShiftId(), request.getUserId(), scheduleEntry.getScheduleEntryId());

        scheduleEntry.setUserId(request.getUserId());
        scheduleEntry.setStatus(resolveStatus(request.getStatus()));
        scheduleEntry.setTimesheetExported(false);
        scheduleEntry.setTimesheetExportedAt(null);
        scheduleEntryRepository.save(scheduleEntry);
        recordAudit(
                accessToken,
                "PLANNING",
                "UPDATED",
                "ASSIGNMENT",
                scheduleEntry.getScheduleEntryId(),
                List.of(
                        textPart(" updated assignment of "),
                        userLink(scheduleEntry.getUserId()),
                        textPart(" on "),
                        shiftLink(project, shift)
                )
        );

        PlanningAssignmentMutationResponseDTO response = new PlanningAssignmentMutationResponseDTO();
        response.setScheduleEntryId(scheduleEntry.getScheduleEntryId());
        response.setShiftId(shift.getShiftId());
        return response;
    }

    @Transactional
    public void deleteAssignment(UUID companyId, UUID scheduleEntryId) {
        deleteAssignment(companyId, scheduleEntryId, null);
    }

    @Transactional
    public void deleteAssignment(UUID companyId, UUID scheduleEntryId, String accessToken) {
        ScheduleEntry scheduleEntry = requireScheduleEntry(scheduleEntryId);
        Shift shift = requireShift(scheduleEntry.getShiftId());
        Project project = requireEditableProject(companyId, shift.getProjectId());
        scheduleEntryRepository.delete(scheduleEntry);
        recordAudit(
                accessToken,
                "PLANNING",
                "REMOVED",
                "ASSIGNMENT",
                scheduleEntry.getScheduleEntryId(),
                List.of(
                        textPart(" removed "),
                        userLink(scheduleEntry.getUserId()),
                        textPart(" from "),
                        shiftLink(project, shift)
                )
        );
    }

    private void recordAudit(
            String accessToken,
            String category,
            String action,
            String entityType,
            UUID entityId,
            List<AuditLogMessagePartDTO> messageParts
    ) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank()) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory(category);
        request.setAction(action);
        request.setEntityType(entityType);
        request.setEntityId(entityId == null ? null : entityId.toString());
        request.setMessageParts(messageParts);
        try {
            auditLogClient.record(accessToken, request);
        } catch (RuntimeException ex) {
            log.warn("Failed to record planning audit event {} for {} {}", action, entityType, entityId, ex);
        }
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO userLink(UUID userId) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("USER");
        part.setEntityId(userId == null ? null : userId.toString());
        part.setRoute(userId == null ? null : "/management/users/" + userId);
        return part;
    }

    private static AuditLogMessagePartDTO clientLink(ClientCompany clientCompany) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("CLIENT_COMPANY");
        part.setEntityId(clientCompany.getClientCompanyId() == null ? null : clientCompany.getClientCompanyId().toString());
        part.setLabel(clientCompany.getName());
        part.setRoute("/management/clients");
        return part;
    }

    private static AuditLogMessagePartDTO locationLink(PlanningLocation location) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("PLANNING_LOCATION");
        part.setEntityId(location.getLocationId() == null ? null : location.getLocationId().toString());
        part.setLabel(location.getName());
        part.setRoute("/management/locations");
        return part;
    }

    private static AuditLogMessagePartDTO projectLink(Project project) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("PROJECT");
        part.setEntityId(project.getProjectId() == null ? null : project.getProjectId().toString());
        part.setLabel(project.getName());
        part.setRoute(project.getProjectId() == null ? "/management/planning" : "/management/planning/projects/" + project.getProjectId());
        return part;
    }

    private static AuditLogMessagePartDTO shiftLink(Project project, Shift shift) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("SHIFT");
        part.setEntityId(shift.getShiftId() == null ? null : shift.getShiftId().toString());
        part.setLabel(shiftLabel(shift));
        if (project != null && project.getProjectId() != null && shift.getShiftId() != null) {
            part.setRoute("/management/planning/projects/" + project.getProjectId() + "/shifts/" + shift.getShiftId());
        }
        return part;
    }

    private static String shiftLabel(Shift shift) {
        String name = shift.getName() == null || shift.getName().isBlank() ? shift.getFunctionName() : shift.getName();
        return name == null || name.isBlank() ? "shift" : name;
    }

    private Project requireEditableProject(UUID companyId, UUID projectId) {
        Project project = projectRepository.findByProjectIdAndCompanyId(projectId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Planning project not found"));
        if (Boolean.TRUE.equals(project.getFinalized())) {
            throw new IllegalArgumentException("Finalized projects can no longer be changed");
        }
        return project;
    }

    private Shift requireShift(UUID shiftId) {
        return shiftRepository.findById(shiftId)
                .orElseThrow(() -> new IllegalArgumentException("Shift not found"));
    }

    private ScheduleEntry requireScheduleEntry(UUID scheduleEntryId) {
        return scheduleEntryRepository.findById(scheduleEntryId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
    }

    private void validateProjectRequest(UUID companyId, PlanningProjectSaveRequestDTO request) {
        validateProjectDates(request.getStartDate(), request.getEndDate());
        validateDefaultTimes(request.getDefaultStartTime(), request.getDefaultEndTime());
        PlanningTimeZoneSupport.normalizeProjectTimezone(request.getProjectTimezone());
        if (request.getClientCompanyId() != null) {
            resolveClientCompanyId(companyId, request.getClientCompanyId());
        }
        if (request.getSavedLocationId() != null) {
            requireLocation(companyId, request.getSavedLocationId());
        }
    }

    private void validateProjectDates(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("Project start and end dates are required");
        }
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("Project end date cannot be before the start date");
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
            throw new IllegalArgumentException("Default project end time must be after the start time");
        }
    }

    private void validateShift(Project project, PlanningShiftSaveRequestDTO request) {
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
        if (!isWithinProjectRange(startTime, endTime, project.getStartDate(), project.getEndDate())) {
            throw new IllegalArgumentException("Shift must stay within the selected project date range");
        }
        if (request.getSavedLocationId() != null) {
            requireLocation(project.getCompanyId(), request.getSavedLocationId());
        }
    }

    private boolean isWithinProjectRange(
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
        dto.setProfilePictureUrl(clientCompany.getProfilePictureUrl());
        dto.setContacts(clientCompany.getContacts().stream()
                .map(this::toClientCompanyContactDto)
                .toList());
        dto.setCreatedAt(clientCompany.getCreatedAt());
        return dto;
    }

    private PlanningLocationDTO toLocationDto(
            PlanningLocation location,
            PlanningClientLocationUsage selectedClientUsage,
            List<PlanningClientLocationUsage> usages
    ) {
        PlanningLocationDTO dto = new PlanningLocationDTO();
        dto.setLocationId(location.getLocationId());
        dto.setName(location.getName());
        dto.setStreetName(location.getStreetName());
        dto.setHouseNumber(location.getHouseNumber());
        dto.setHouseNumberSuffix(location.getHouseNumberSuffix());
        dto.setPostalCode(location.getPostalCode());
        dto.setCity(location.getCity());
        dto.setNotes(location.getNotes());
        dto.setPrioritizedClientCompanyIds(usages.stream()
                .filter(PlanningClientLocationUsage::isManuallyPrioritized)
                .map(PlanningClientLocationUsage::getClientCompanyId)
                .toList());
        dto.setPreferredForClient(selectedClientUsage != null
                ? Boolean.TRUE
                : usages.stream().anyMatch(PlanningClientLocationUsage::isManuallyPrioritized));
        dto.setLastUsedAtForClient(selectedClientUsage != null ? selectedClientUsage.getLastUsedAt() : null);
        dto.setCreatedAt(location.getCreatedAt());
        dto.setUpdatedAt(location.getUpdatedAt());
        return dto;
    }

    private List<PlanningClientLocationUsage> syncManualLocationPriorities(
            UUID companyId,
            List<UUID> prioritizedClientCompanyIds,
            PlanningLocation location
    ) {
        List<UUID> requestedIds = prioritizedClientCompanyIds == null
                ? List.of()
                : prioritizedClientCompanyIds.stream().filter(Objects::nonNull).distinct().toList();
        requestedIds.forEach(clientCompanyId -> requireClientCompany(companyId, clientCompanyId));

        List<PlanningClientLocationUsage> existing =
                new ArrayList<>(planningClientLocationUsageRepository.findByLocationId(location.getLocationId()));
        Map<UUID, PlanningClientLocationUsage> existingByClientId = existing.stream()
                .collect(Collectors.toMap(PlanningClientLocationUsage::getClientCompanyId, Function.identity()));
        Set<UUID> requestedIdSet = new HashSet<>(requestedIds);

        for (PlanningClientLocationUsage usage : existing) {
            boolean manuallyPrioritized = requestedIdSet.contains(usage.getClientCompanyId());
            usage.setManuallyPrioritized(manuallyPrioritized);
            if (!manuallyPrioritized && usage.getLastUsedAt() == null) {
                planningClientLocationUsageRepository.delete(usage);
            } else {
                planningClientLocationUsageRepository.save(usage);
            }
        }

        for (UUID clientCompanyId : requestedIds) {
            if (existingByClientId.containsKey(clientCompanyId)) {
                continue;
            }
            PlanningClientLocationUsage usage = new PlanningClientLocationUsage();
            usage.setClientCompanyId(clientCompanyId);
            usage.setLocationId(location.getLocationId());
            usage.setManuallyPrioritized(true);
            existing.add(planningClientLocationUsageRepository.save(usage));
        }

        return existing.stream()
                .filter(usage -> usage.isManuallyPrioritized() || usage.getLastUsedAt() != null)
                .toList();
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
            return new ArrayList<>();
        }

        return contacts.stream()
                .map(this::normalizeContact)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
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
        return requireClientCompany(companyId, clientCompanyId).getClientCompanyId();
    }

    private ClientCompany requireClientCompany(UUID companyId, UUID clientCompanyId) {
        return clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Selected client company was not found"));
    }

    private PlanningLocation requireLocation(UUID companyId, UUID locationId) {
        return planningLocationRepository.findByLocationIdAndOwnerCompanyId(locationId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Saved location not found"));
    }

    private PlanningLocation resolveSavedLocation(UUID companyId, UUID locationId) {
        if (locationId == null) {
            return null;
        }
        return requireLocation(companyId, locationId);
    }

    private String resolveLocationValue(String requestLocation, PlanningLocation savedLocation) {
        if (savedLocation != null) {
            return savedLocation.getName();
        }
        return normalizeOptionalText(requestLocation);
    }

    private PlanningClientLocationUsage touchLocationUsage(UUID companyId, UUID clientCompanyId, PlanningLocation location) {
        if (clientCompanyId == null || location == null) {
            return null;
        }
        requireClientCompany(companyId, clientCompanyId);
        PlanningClientLocationUsage usage = planningClientLocationUsageRepository
                .findByClientCompanyIdAndLocationId(clientCompanyId, location.getLocationId())
                .orElseGet(PlanningClientLocationUsage::new);
        usage.setClientCompanyId(clientCompanyId);
        usage.setLocationId(location.getLocationId());
        usage.setLastUsedAt(LocalDateTime.now());
        return planningClientLocationUsageRepository.save(usage);
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

    private String normalizeClientProfilePicture(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            return null;
        }
        if (!normalized.startsWith("data:image/")) {
            throw new IllegalArgumentException("Client profile picture must be an image");
        }
        if (normalized.length() > MAX_CLIENT_PROFILE_PICTURE_LENGTH) {
            throw new IllegalArgumentException("Client profile picture is too large");
        }
        return normalized;
    }

    private String normalizeProjectStatus(String value) {
        if (value == null || value.trim().isEmpty()) {
            return DEFAULT_PROJECT_STATUS;
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
