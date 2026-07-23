package com.pm.planningservice.service;

import com.pm.planningservice.dto.OpenShiftDTO;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.model.ShiftApplication;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftApplicationRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ShiftApplicationService {
    private final ProjectRepository projectRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final ShiftApplicationRepository shiftApplicationRepository;

    public ShiftApplicationService(
            ProjectRepository projectRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            ShiftApplicationRepository shiftApplicationRepository
    ) {
        this.projectRepository = projectRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.shiftApplicationRepository = shiftApplicationRepository;
    }

    @Transactional(readOnly = true)
    public List<OpenShiftDTO> getOpenShifts(UUID companyId, UUID userId) {
        List<Project> projects = projectRepository.findByCompanyIdOrderByStartDateAsc(companyId).stream()
                .filter(project -> !Boolean.TRUE.equals(project.getFinalized()))
                .toList();
        if (projects.isEmpty()) {
            return List.of();
        }

        Map<UUID, Project> projectsById = projects.stream()
                .collect(Collectors.toMap(Project::getProjectId, Function.identity()));
        List<Shift> upcomingShifts = shiftRepository.findByProjectIdIn(projectsById.keySet()).stream()
                .filter(shift -> !hasShiftStarted(shift, projectsById.get(shift.getProjectId())))
                .toList();
        if (upcomingShifts.isEmpty()) {
            return List.of();
        }

        List<UUID> shiftIds = upcomingShifts.stream().map(Shift::getShiftId).toList();
        Map<UUID, Integer> assignedCounts = loadAssignedCounts(shiftIds);
        Set<UUID> myScheduledShiftIds = scheduleEntryRepository.findByUserId(userId).stream()
                .filter(entry -> entry.getStatus() != ScheduleEntryStatus.CANCELLED)
                .map(ScheduleEntry::getShiftId)
                .collect(Collectors.toSet());
        Map<UUID, ShiftApplication> myApplicationsByShiftId = shiftApplicationRepository.findByUserId(userId).stream()
                .collect(Collectors.toMap(ShiftApplication::getShiftId, Function.identity(), (left, right) -> left));

        return upcomingShifts.stream()
                .filter(shift -> !myScheduledShiftIds.contains(shift.getShiftId()))
                // Full shifts stay visible to applicants so they can still withdraw.
                .filter(shift -> myApplicationsByShiftId.containsKey(shift.getShiftId())
                        || hasOpenSpots(shift, assignedCounts))
                .map(shift -> mapOpenShift(
                        shift,
                        projectsById.get(shift.getProjectId()),
                        assignedCounts,
                        myApplicationsByShiftId.get(shift.getShiftId())
                ))
                .sorted(Comparator
                        .comparing(OpenShiftDTO::getStartTime)
                        .thenComparing(OpenShiftDTO::getShiftName, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    @Transactional
    public OpenShiftDTO apply(UUID companyId, UUID userId, UUID shiftId) {
        Shift shift = requireShift(shiftId, companyId);
        Project project = requireProject(shift, companyId);
        if (Boolean.TRUE.equals(project.getFinalized())) {
            throw new IllegalArgumentException("This project is no longer open for applications");
        }
        if (hasShiftStarted(shift, project)) {
            throw new IllegalArgumentException("This shift has already started");
        }
        boolean alreadyScheduled = scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)
                .filter(entry -> entry.getStatus() != ScheduleEntryStatus.CANCELLED)
                .isPresent();
        if (alreadyScheduled) {
            throw new IllegalArgumentException("You are already scheduled on this shift");
        }
        if (shiftApplicationRepository.findFirstByShiftIdAndUserId(shiftId, userId).isPresent()) {
            throw new IllegalArgumentException("You have already applied to this shift");
        }
        Map<UUID, Integer> assignedCounts = loadAssignedCounts(List.of(shiftId));
        if (!hasOpenSpots(shift, assignedCounts)) {
            throw new IllegalArgumentException("This shift is already fully staffed");
        }

        ShiftApplication application = new ShiftApplication();
        application.setShiftId(shiftId);
        application.setUserId(userId);
        application.setAppliedAt(LocalDateTime.now());
        ShiftApplication saved = shiftApplicationRepository.save(application);
        return mapOpenShift(shift, project, assignedCounts, saved);
    }

    @Transactional
    public OpenShiftDTO withdraw(UUID companyId, UUID userId, UUID shiftId) {
        Shift shift = requireShift(shiftId, companyId);
        Project project = requireProject(shift, companyId);
        ShiftApplication application = shiftApplicationRepository.findFirstByShiftIdAndUserId(shiftId, userId)
                .orElseThrow(() -> new IllegalArgumentException("You have not applied to this shift"));
        shiftApplicationRepository.delete(application);
        return mapOpenShift(shift, project, loadAssignedCounts(List.of(shiftId)), null);
    }

    private boolean hasShiftStarted(Shift shift, Project project) {
        return !shift.getStartTime().isAfter(PlanningTimeZoneSupport.nowInProjectTimezone(project));
    }

    private boolean hasOpenSpots(Shift shift, Map<UUID, Integer> assignedCounts) {
        int peopleNeeded = shift.getPeopleNeeded() == null || shift.getPeopleNeeded() < 1 ? 1 : shift.getPeopleNeeded();
        return assignedCounts.getOrDefault(shift.getShiftId(), 0) < peopleNeeded;
    }

    private Map<UUID, Integer> loadAssignedCounts(List<UUID> shiftIds) {
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
                        view -> view.getAssignedCount() == null ? 0 : Math.toIntExact(view.getAssignedCount())
                ));
    }

    private Shift requireShift(UUID shiftId, UUID companyId) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new IllegalArgumentException("Shift not found"));
        requireProject(shift, companyId);
        return shift;
    }

    private Project requireProject(Shift shift, UUID companyId) {
        Project project = projectRepository.findById(shift.getProjectId())
                .orElseThrow(() -> new IllegalArgumentException("Shift not found"));
        if (!companyId.equals(project.getCompanyId())) {
            throw new IllegalArgumentException("Shift not found");
        }
        return project;
    }

    private OpenShiftDTO mapOpenShift(
            Shift shift,
            Project project,
            Map<UUID, Integer> assignedCounts,
            ShiftApplication application
    ) {
        int peopleNeeded = shift.getPeopleNeeded() == null || shift.getPeopleNeeded() < 1 ? 1 : shift.getPeopleNeeded();
        int assigned = assignedCounts.getOrDefault(shift.getShiftId(), 0);

        OpenShiftDTO dto = new OpenShiftDTO();
        dto.setShiftId(shift.getShiftId());
        dto.setProjectId(project.getProjectId());
        dto.setProjectName(project.getName());
        dto.setExternalDescription(project.getExternalDescription());
        dto.setProjectLocation(project.getLocation());
        dto.setShiftName(shift.getName() == null || shift.getName().isBlank() ? shift.getFunctionName() : shift.getName());
        dto.setShiftDate(shift.getStartTime().toLocalDate());
        dto.setStartTime(shift.getStartTime());
        dto.setEndTime(shift.getEndTime());
        dto.setBreakMinutes(shift.getBreakMinutes() == null ? 0 : shift.getBreakMinutes());
        dto.setFunctionName(shift.getFunctionName());
        dto.setShiftLocation(shift.getLocation() == null || shift.getLocation().isBlank() ? project.getLocation() : shift.getLocation());
        dto.setPeopleNeeded(peopleNeeded);
        dto.setSpotsRemaining(Math.max(0, peopleNeeded - assigned));
        dto.setApplied(application != null);
        dto.setAppliedAt(application == null ? null : application.getAppliedAt());
        return dto;
    }
}
