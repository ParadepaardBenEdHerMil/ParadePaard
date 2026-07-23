package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningDayDTO;
import com.pm.planningservice.dto.PlanningResourceAllocationDTO;
import com.pm.planningservice.dto.PlanningShiftDTO;
import com.pm.planningservice.dto.PlanningViewResponseDTO;
import com.pm.planningservice.dto.ShiftApplicantDTO;
import com.pm.planningservice.integration.UserDirectoryClient;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.model.ShiftApplication;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftApplicationRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PlanningViewService {
    private final ClientCompanyRepository clientCompanyRepository;
    private final ProjectRepository projectRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final ShiftApplicationRepository shiftApplicationRepository;
    private final UserDirectoryClient userDirectoryClient;

    public PlanningViewService(
            ClientCompanyRepository clientCompanyRepository,
            ProjectRepository projectRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            ShiftApplicationRepository shiftApplicationRepository,
            UserDirectoryClient userDirectoryClient) {
        this.clientCompanyRepository = clientCompanyRepository;
        this.projectRepository = projectRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.shiftApplicationRepository = shiftApplicationRepository;
        this.userDirectoryClient = userDirectoryClient;
    }

    public List<PlanningViewResponseDTO> getPlanningHierarchy(
            UUID companyId,
            UUID projectFilterId,
            LocalDate startDate,
            LocalDate endDate,
            boolean includeAllocationDetails) {
        List<Project> projects = resolveProjects(companyId, projectFilterId, startDate, endDate);
        if (projects.isEmpty()) {
            return List.of();
        }

        List<UUID> projectIds = projects.stream()
                .map(Project::getProjectId)
                .toList();
        List<Shift> shifts = resolveShifts(projectIds, projectFilterId, startDate, endDate);
        Map<UUID, List<Shift>> shiftsByProjectId = shifts.stream()
                .sorted(Comparator.comparing(Shift::getStartTime))
                .collect(Collectors.groupingBy(Shift::getProjectId));

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

        List<ShiftApplication> applications = shiftIds.isEmpty()
                ? List.of()
                : shiftApplicationRepository.findByShiftIdIn(shiftIds);
        Map<UUID, List<ShiftApplication>> applicationsByShiftId = applications.stream()
                .collect(Collectors.groupingBy(ShiftApplication::getShiftId));

        Set<UUID> userIds = new HashSet<>();
        if (includeAllocationDetails) {
            entries.stream().map(ScheduleEntry::getUserId).forEach(userIds::add);
            applications.stream().map(ShiftApplication::getUserId).forEach(userIds::add);
        }
        Map<UUID, String> userDisplayNames = includeAllocationDetails
                ? userDirectoryClient.getDisplayNamesByUserIds(userIds)
                : Map.of();
        Map<UUID, String> clientCompanyNames = loadClientCompanyNames(companyId, projects);

        return projects.stream()
                .map(project -> mapProjectHierarchy(
                        project,
                        shiftsByProjectId,
                        entriesByShiftId,
                        assignmentCountsByShiftId,
                        applicationsByShiftId,
                        userDisplayNames,
                        clientCompanyNames,
                        includeAllocationDetails
                ))
                .toList();
    }

    private List<Project> resolveProjects(UUID companyId, UUID projectFilterId, LocalDate startDate, LocalDate endDate) {
        if (projectFilterId == null) {
            if (hasValidDateRange(startDate, endDate)) {
                return projectRepository.findByCompanyIdAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByStartDateAsc(
                        companyId,
                        endDate,
                        startDate
                );
            }
            return projectRepository.findByCompanyIdOrderByStartDateAsc(companyId);
        }
        return projectRepository.findByProjectIdAndCompanyId(projectFilterId, companyId)
                .map(List::of)
                .orElse(List.of());
    }

    private List<Shift> resolveShifts(List<UUID> projectIds, UUID projectFilterId, LocalDate startDate, LocalDate endDate) {
        if (projectIds.isEmpty()) {
            return List.of();
        }
        if (projectFilterId == null && hasValidDateRange(startDate, endDate)) {
            LocalDateTime startInclusive = startDate.atStartOfDay();
            LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();
            return shiftRepository.findByProjectIdInAndStartTimeLessThanAndEndTimeGreaterThan(
                    projectIds,
                    endExclusive,
                    startInclusive
            );
        }
        return shiftRepository.findByProjectIdIn(projectIds);
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

    private PlanningViewResponseDTO mapProjectHierarchy(
            Project project,
            Map<UUID, List<Shift>> shiftsByProjectId,
            Map<UUID, List<ScheduleEntry>> entriesByShiftId,
            Map<UUID, ShiftAssignmentCounts> assignmentCountsByShiftId,
            Map<UUID, List<ShiftApplication>> applicationsByShiftId,
            Map<UUID, String> userDisplayNames,
            Map<UUID, String> clientCompanyNames,
            boolean includeAllocationDetails) {
        PlanningViewResponseDTO response = new PlanningViewResponseDTO();
        response.setProjectId(project.getProjectId());
        response.setProjectName(project.getName());
        response.setStartDate(project.getStartDate());
        response.setEndDate(project.getEndDate());
        response.setClientCompanyId(project.getClientCompanyId());
        response.setClientCompanyName(resolveClientCompanyName(project.getClientCompanyId(), clientCompanyNames));
        response.setInternalDescription(project.getInternalDescription());
        response.setExternalDescription(project.getExternalDescription());
        response.setDefaultStartTime(project.getDefaultStartTime());
        response.setDefaultEndTime(project.getDefaultEndTime());
        response.setProjectTimezone(PlanningTimeZoneSupport.normalizeProjectTimezone(project.getProjectTimezone()));
        response.setLocation(project.getLocation());
        response.setStatus(project.getStatus());
        response.setCreatedByUserId(project.getCreatedByUserId());
        response.setCreatedAt(project.getCreatedAt());
        response.setUpdatedAt(project.getUpdatedAt());
        response.setFinalized(project.getFinalized());
        response.setFinalizedAt(project.getFinalizedAt());

        Map<LocalDate, List<PlanningShiftDTO>> shiftsByDay = new LinkedHashMap<>();
        List<Shift> projectShifts = shiftsByProjectId.getOrDefault(project.getProjectId(), List.of());
        int peopleNeededTotal = 0;
        for (Shift shift : projectShifts) {
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
            List<ShiftApplication> shiftApplications = applicationsByShiftId.getOrDefault(shift.getShiftId(), List.of());
            shiftDto.setApplicantCount(shiftApplications.size());
            if (includeAllocationDetails) {
                shiftDto.setAllocations(shiftEntries.stream()
                        .map(entry -> mapAllocation(shift, entry, userDisplayNames))
                        .sorted(Comparator.comparing(PlanningResourceAllocationDTO::getStartTime))
                        .toList());
                shiftDto.setApplicants(shiftApplications.stream()
                        .sorted(Comparator.comparing(ShiftApplication::getAppliedAt))
                        .map(application -> mapApplicant(application, userDisplayNames))
                        .toList());
            } else {
                shiftDto.setAllocations(List.of());
                shiftDto.setApplicants(List.of());
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

    private ShiftApplicantDTO mapApplicant(ShiftApplication application, Map<UUID, String> userDisplayNames) {
        ShiftApplicantDTO dto = new ShiftApplicantDTO();
        dto.setUserId(application.getUserId());
        dto.setUserDisplayName(userDisplayNames.get(application.getUserId()));
        dto.setAppliedAt(application.getAppliedAt());
        return dto;
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

    private Map<UUID, String> loadClientCompanyNames(UUID companyId, List<Project> projects) {
        Set<UUID> clientCompanyIds = projects.stream()
                .map(Project::getClientCompanyId)
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
