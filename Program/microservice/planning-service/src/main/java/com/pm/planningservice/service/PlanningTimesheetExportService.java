package com.pm.planningservice.service;

import com.pm.planningservice.integration.CompanySettingsClient;
import com.pm.planningservice.integration.CompanySettingsDTO;
import com.pm.planningservice.integration.TimesheetGrpcClient;
import com.pm.planningservice.integration.UserDirectoryClient;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.model.TravelClaim;
import com.pm.planningservice.model.TravelClaimStatus;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import com.pm.planningservice.repository.TravelClaimRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import timesheet.ImportPlannedTimesheetsResponse;
import timesheet.PlannedTimesheetRecord;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PlanningTimesheetExportService {
    private static final BigDecimal DEFAULT_TRAVEL_RATE = new BigDecimal("0.23");

    private final ShiftRepository shiftRepository;
    private final ProjectRepository projectRepository;
    private final ScheduleEntryRepository scheduleEntryRepository;
    private final TravelClaimRepository travelClaimRepository;
    private final TimesheetGrpcClient timesheetGrpcClient;
    private final CompanySettingsClient companySettingsClient;
    private final UserDirectoryClient userDirectoryClient;

    public PlanningTimesheetExportService(
            ShiftRepository shiftRepository,
            ProjectRepository projectRepository,
            ScheduleEntryRepository scheduleEntryRepository,
            TravelClaimRepository travelClaimRepository,
            TimesheetGrpcClient timesheetGrpcClient,
            CompanySettingsClient companySettingsClient,
            UserDirectoryClient userDirectoryClient
    ) {
        this.shiftRepository = shiftRepository;
        this.projectRepository = projectRepository;
        this.scheduleEntryRepository = scheduleEntryRepository;
        this.travelClaimRepository = travelClaimRepository;
        this.timesheetGrpcClient = timesheetGrpcClient;
        this.companySettingsClient = companySettingsClient;
        this.userDirectoryClient = userDirectoryClient;
    }

    public String getTimesheetLoggingMode(UUID companyId) {
        CompanySettingsDTO settings = companySettingsClient.getCompanySettings(companyId);
        String mode = settings == null ? null : settings.getTimesheetLoggingMode();
        return mode == null || mode.isBlank() ? "ADMIN_FINALIZE" : mode.trim().toUpperCase();
    }

    public String getTravelClaimMode(UUID companyId) {
        CompanySettingsDTO settings = companySettingsClient.getCompanySettings(companyId);
        String mode = settings == null ? null : settings.getTravelClaimMode();
        return mode == null || mode.isBlank() ? "REQUIRES_APPROVAL" : mode.trim().toUpperCase();
    }

    public boolean usesAutoOnShiftEnd(UUID companyId) {
        return "AUTO_ON_SHIFT_END".equals(getTimesheetLoggingMode(companyId));
    }

    public boolean usesAdminFinalize(UUID companyId) {
        return "ADMIN_FINALIZE".equals(getTimesheetLoggingMode(companyId));
    }

    @Transactional
    public ExportResult exportScheduleEntries(UUID companyId, List<ScheduleEntry> rawEntries) {
        List<ScheduleEntry> entries = rawEntries.stream()
                .filter(entry -> entry.getStatus() == ScheduleEntryStatus.CONFIRMED)
                .filter(entry -> !Boolean.TRUE.equals(entry.getTimesheetExported()))
                .toList();
        if (entries.isEmpty()) {
            return new ExportResult(0, 0, List.of(), 0);
        }

        Map<UUID, Shift> shiftById = shiftRepository.findAllById(
                        entries.stream().map(ScheduleEntry::getShiftId).distinct().toList()
                ).stream()
                .collect(Collectors.toMap(Shift::getShiftId, shift -> shift));

        Map<UUID, Project> projectById = projectRepository.findByProjectIdIn(
                        shiftById.values().stream().map(Shift::getProjectId).distinct().toList()
                ).stream()
                .filter(project -> companyId.equals(project.getCompanyId()))
                .collect(Collectors.toMap(Project::getProjectId, project -> project));

        Map<UUID, TravelClaim> claimByScheduleEntryId = travelClaimRepository.findByScheduleEntryIdIn(
                        entries.stream().map(ScheduleEntry::getScheduleEntryId).toList()
                ).stream()
                .collect(Collectors.toMap(TravelClaim::getScheduleEntryId, claim -> claim));
        Map<UUID, String> userDisplayNamesById = userDirectoryClient.getDisplayNamesByUserIds(
                entries.stream().map(ScheduleEntry::getUserId).collect(Collectors.toSet())
        );

        List<String> warnings = new ArrayList<>();
        List<PlannedTimesheetRecord> records = new ArrayList<>();
        for (ScheduleEntry entry : entries) {
            Shift shift = shiftById.get(entry.getShiftId());
            if (shift == null) {
                warnings.add("Skipped scheduleEntryId=" + entry.getScheduleEntryId() + " reason=Shift not found");
                continue;
            }
            Project project = projectById.get(shift.getProjectId());
            if (project == null) {
                warnings.add("Skipped scheduleEntryId=" + entry.getScheduleEntryId() + " reason=Project not found");
                continue;
            }

            TravelClaim claim = claimByScheduleEntryId.get(entry.getScheduleEntryId());
            boolean includeTravel = claim != null
                    && (claim.getStatus() == TravelClaimStatus.APPROVED || claim.getStatus() == TravelClaimStatus.AUTO_APPROVED);

            PlannedTimesheetRecord.Builder builder = PlannedTimesheetRecord.newBuilder()
                    .setUserId(entry.getUserId().toString())
                    .setCompanyId(project.getCompanyId() == null ? "" : project.getCompanyId().toString())
                    .setDateOfIssue(shift.getStartTime().toLocalDate().toString())
                    .setName(resolveEmployeeName(entry.getUserId(), userDisplayNamesById))
                    .setProjectName(project.getName())
                    .setFunction(shift.getFunctionName())
                    .setHoursWorked(calculateWorkedHours(shift).toPlainString())
                    .setTravelExpenses(includeTravel ? claim.getTotalAmount().toPlainString() : "0.00")
                    .setSourceProjectId(project.getProjectId().toString())
                    .setSourceShiftId(shift.getShiftId().toString())
                    .setSourceScheduleEntryId(entry.getScheduleEntryId().toString())
                    .setShiftName(resolveShiftName(shift))
                    .setShiftDate(shift.getStartTime().toLocalDate().toString())
                    .setShiftStartTime(shift.getStartTime().toString())
                    .setShiftEndTime(shift.getEndTime().toString())
                    .setBreakMinutes(shift.getBreakMinutes() == null ? 0 : Math.max(shift.getBreakMinutes(), 0))
                    .setTravelKilometers(includeTravel ? claim.getKilometers().toPlainString() : "")
                    .setTravelRate(includeTravel ? claim.getRatePerKilometer().toPlainString() : "");
            records.add(builder.build());
        }

        if (records.isEmpty()) {
            return new ExportResult(0, 0, warnings, 0);
        }

        ImportPlannedTimesheetsResponse response = timesheetGrpcClient.importPlannedTimesheets("planning-service", records);
        warnings.addAll(response.getWarningsList());

        Set<UUID> failedEntryIds = parseFailedEntryIds(warnings);
        LocalDateTime exportedAt = LocalDateTime.now();
        List<ScheduleEntry> successfulEntries = entries.stream()
                .filter(entry -> !failedEntryIds.contains(entry.getScheduleEntryId()))
                .peek(entry -> {
                    entry.setTimesheetExported(true);
                    entry.setTimesheetExportedAt(exportedAt);
                })
                .toList();
        if (!successfulEntries.isEmpty()) {
            scheduleEntryRepository.saveAll(successfulEntries);
        }

        return new ExportResult(
                response.getCreatedCount(),
                response.getUpdatedCount(),
                warnings,
                successfulEntries.size()
        );
    }

    public BigDecimal getDefaultTravelRate() {
        return DEFAULT_TRAVEL_RATE;
    }

    private Set<UUID> parseFailedEntryIds(List<String> warnings) {
        Set<UUID> failedIds = new HashSet<>();
        for (String warning : warnings) {
            if (warning == null || !warning.startsWith("Skipped scheduleEntryId=")) {
                continue;
            }
            int start = "Skipped scheduleEntryId=".length();
            int end = warning.indexOf(" reason=");
            String raw = end > start ? warning.substring(start, end) : warning.substring(start);
            try {
                failedIds.add(UUID.fromString(raw.trim()));
            } catch (IllegalArgumentException ignored) {
                // keep warning only
            }
        }
        return failedIds;
    }

    private BigDecimal calculateWorkedHours(Shift shift) {
        return ShiftHoursCalculator.workedHours(shift.getStartTime(), shift.getEndTime(), shift.getBreakMinutes());
    }

    private String resolveShiftName(Shift shift) {
        return shift.getName() == null || shift.getName().isBlank() ? shift.getFunctionName() : shift.getName();
    }

    private String resolveEmployeeName(UUID userId, Map<UUID, String> userDisplayNamesById) {
        String displayName = userDisplayNamesById.get(userId);
        if (displayName == null || displayName.isBlank()) {
            return userId.toString();
        }
        return displayName;
    }

    public record ExportResult(int createdCount, int updatedCount, List<String> warnings, int exportedCount) {
    }
}
