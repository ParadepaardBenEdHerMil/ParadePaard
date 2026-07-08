package com.pm.planningservice.service;

import com.pm.planningservice.dto.AuditLogCreateRequestDTO;
import com.pm.planningservice.dto.AuditLogMessagePartDTO;
import com.pm.planningservice.dto.FinalizePlanningRequestDTO;
import com.pm.planningservice.dto.FinalizePlanningResponseDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
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
            ScheduleEntryStatus.CONFIRMED
    );

    private final ProjectRepository projectRepository;
    private final ShiftRepository shiftRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final PlanningTimesheetExportService planningTimesheetExportService;

    private static final Logger log = LoggerFactory.getLogger(PlanningFinalizationService.class);
    // Optional so unit tests that build this service by hand keep working (null => no audit).
    @Autowired(required = false)
    private AuditLogClient auditLogClient;

    public PlanningFinalizationService(
            ProjectRepository projectRepository,
            ShiftRepository shiftRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            PlanningTimesheetExportService planningTimesheetExportService) {
        this.projectRepository = projectRepository;
        this.shiftRepository = shiftRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.planningTimesheetExportService = planningTimesheetExportService;
    }

    @Transactional
    public FinalizePlanningResponseDTO finalizePlanning(FinalizePlanningRequestDTO request, String accessToken) {
        validateRequest(request);
        if (!planningTimesheetExportService.usesAdminFinalize(request.getCompanyId())) {
            throw new IllegalArgumentException("This company uses automatic timesheet logging");
        }

        TimeWindow weekWindow = request.getProjectId() == null
                ? toIsoWeekWindow(request.getIsoWeek(), request.getWeekBasedYear())
                : null;
        List<Project> candidateProjects = request.getProjectId() != null
                ? resolveSingleProject(request.getCompanyId(), request.getProjectId())
                : resolveProjectsByIsoWeek(request.getCompanyId(), weekWindow);

        List<Project> targetProjects = candidateProjects.stream()
                .filter(project -> !Boolean.TRUE.equals(project.getFinalized()))
                .toList();
        if (targetProjects.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        List<UUID> projectIds = targetProjects.stream().map(Project::getProjectId).toList();
        Set<UUID> projectIdSet = Set.copyOf(projectIds);
        List<Shift> shifts = request.getProjectId() != null
                ? shiftRepository.findByProjectIdIn(projectIds)
                : shiftRepository.findByStartTimeGreaterThanEqualAndStartTimeLessThan(weekWindow.start(), weekWindow.end())
                .stream()
                .filter(shift -> projectIdSet.contains(shift.getProjectId()))
                .toList();
        shifts = shifts.stream()
                .sorted(Comparator.comparing(Shift::getStartTime))
                .toList();
        if (shifts.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        List<UUID> shiftIds = shifts.stream().map(Shift::getShiftId).toList();
        List<ScheduleEntry> entries = scheduleEntryRepository.findByShiftIdInAndStatusInAndTimesheetExportedFalse(shiftIds, EXPORTABLE_STATUSES);
        if (entries.isEmpty()) {
            FinalizePlanningResponseDTO empty = new FinalizePlanningResponseDTO();
            empty.setCreatedTimesheets(0);
            return empty;
        }

        PlanningTimesheetExportService.ExportResult exportResult =
                planningTimesheetExportService.exportScheduleEntries(request.getCompanyId(), entries);

        LocalDateTime now = LocalDateTime.now();
        targetProjects.forEach(project -> {
            project.setFinalized(true);
            project.setFinalizedAt(now);
            project.setStatus("COMPLETED");
            project.setUpdatedAt(now);
        });
        projectRepository.saveAll(targetProjects);

        recordFinalizeAudit(accessToken, targetProjects.size(), exportResult.createdCount());

        FinalizePlanningResponseDTO response = new FinalizePlanningResponseDTO();
        response.setCreatedTimesheets(exportResult.createdCount());
        response.setFinalizedProjectIds(targetProjects.stream().map(Project::getProjectId).toList());
        response.setWarnings(exportResult.warnings());
        return response;
    }

    // Finalizing locks the planning for those projects and exports timesheets for payroll,
    // so it clearly affects employees and is recorded in the central audit log. The actor is
    // resolved by user-service from the forwarded access token.
    private void recordFinalizeAudit(String accessToken, int finalizedProjects, int createdTimesheets) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank()) {
            return;
        }
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(" finalized planning for " + finalizedProjects + " project(s), creating "
                + createdTimesheets + " timesheet(s)");

        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("PLANNING");
        request.setAction("FINALIZED");
        request.setEntityType("PLANNING");
        request.setMessageParts(List.of(part));
        try {
            auditLogClient.record(accessToken, request);
        } catch (RuntimeException ex) {
            log.warn("Failed to record planning finalization audit event", ex);
        }
    }

    private List<Project> resolveSingleProject(UUID companyId, UUID projectId) {
        return projectRepository.findByProjectIdAndCompanyId(projectId, companyId)
                .map(List::of)
                .orElse(List.of());
    }

    private List<Project> resolveProjectsByIsoWeek(UUID companyId, TimeWindow weekWindow) {
        List<Shift> weekShifts = shiftRepository.findByStartTimeGreaterThanEqualAndStartTimeLessThan(
                weekWindow.start(),
                weekWindow.end()
        );
        Set<UUID> weekProjectIds = weekShifts.stream()
                .map(Shift::getProjectId)
                .collect(Collectors.toSet());
        if (weekProjectIds.isEmpty()) {
            return List.of();
        }

        return projectRepository.findByProjectIdIn(weekProjectIds).stream()
                .filter(project -> companyId.equals(project.getCompanyId()))
                .toList();
    }

    private TimeWindow toIsoWeekWindow(Integer isoWeek, Integer weekBasedYear) {
        LocalDate startOfWeek = LocalDate.of(weekBasedYear, 1, 4)
                .with(WeekFields.ISO.weekOfWeekBasedYear(), isoWeek)
                .with(WeekFields.ISO.dayOfWeek(), 1);
        return new TimeWindow(startOfWeek.atStartOfDay(), startOfWeek.plusDays(7).atStartOfDay());
    }

    private void validateRequest(FinalizePlanningRequestDTO request) {
        boolean hasProject = request.getProjectId() != null;
        boolean hasWeek = request.getIsoWeek() != null || request.getWeekBasedYear() != null;

        if (hasProject && hasWeek) {
            throw new IllegalArgumentException("Provide either projectId or isoWeek/weekBasedYear, not both");
        }
        if (!hasProject && !hasWeek) {
            throw new IllegalArgumentException("Provide projectId or isoWeek/weekBasedYear");
        }
        if (!hasProject && (request.getIsoWeek() == null || request.getWeekBasedYear() == null)) {
            throw new IllegalArgumentException("Both isoWeek and weekBasedYear are required for week finalization");
        }
        if (!hasProject && (request.getIsoWeek() < 1 || request.getIsoWeek() > 53)) {
            throw new IllegalArgumentException("isoWeek must be between 1 and 53");
        }
    }

    private record TimeWindow(LocalDateTime start, LocalDateTime end) {
    }
}
