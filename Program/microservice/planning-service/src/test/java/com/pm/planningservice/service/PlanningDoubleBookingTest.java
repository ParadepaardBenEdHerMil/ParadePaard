package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ScheduleEntry;
import com.pm.planningservice.model.ScheduleEntryStatus;
import com.pm.planningservice.model.Shift;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.PlanningClientLocationUsageRepository;
import com.pm.planningservice.repository.PlanningLocationRepository;
import com.pm.planningservice.repository.ProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectRepository;
import com.pm.planningservice.repository.ScheduleEntryRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * PL-4: an employee must not be double-booked onto two shifts that run at the same
 * time. Overlapping assignments are blocked; back-to-back (touching) shifts are allowed.
 */
@ExtendWith(MockitoExtension.class)
class PlanningDoubleBookingTest {

    @Mock private ClientCompanyRepository clientCompanyRepository;
    @Mock private PlanningLocationRepository planningLocationRepository;
    @Mock private PlanningClientLocationUsageRepository planningClientLocationUsageRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ShiftRepository shiftRepository;
    @Mock private ScheduleEntryRepository scheduleEntryRepository;
    @Mock private ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;
    @Mock private ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;
    @Mock private AuditLogClient auditLogClient;

    @InjectMocks
    private PlanningManagementService service;

    private final UUID companyId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @Test
    void rejectsAssignmentThatOverlapsAnotherOfTheEmployeesShifts() {
        UUID targetShiftId = UUID.randomUUID();
        UUID otherShiftId = UUID.randomUUID();

        Shift target = shift(targetShiftId, LocalDateTime.of(2026, 5, 1, 9, 0), LocalDateTime.of(2026, 5, 1, 17, 0));
        Shift other = shift(otherShiftId, LocalDateTime.of(2026, 5, 1, 12, 0), LocalDateTime.of(2026, 5, 1, 20, 0));

        ScheduleEntry otherEntry = new ScheduleEntry();
        otherEntry.setScheduleEntryId(UUID.randomUUID());
        otherEntry.setShiftId(otherShiftId);
        otherEntry.setUserId(userId);

        when(shiftRepository.findById(targetShiftId)).thenReturn(Optional.of(target));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(project()));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(targetShiftId, userId)).thenReturn(Optional.empty());
        when(scheduleEntryRepository.findByUserId(userId)).thenReturn(List.of(otherEntry));
        when(shiftRepository.findById(otherShiftId)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.createAssignment(companyId, targetShiftId, request()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("overlapping");

        verify(scheduleEntryRepository, never()).save(any());
    }

    @Test
    void allowsBackToBackShiftsThatDoNotOverlap() {
        UUID targetShiftId = UUID.randomUUID();
        UUID otherShiftId = UUID.randomUUID();

        Shift target = shift(targetShiftId, LocalDateTime.of(2026, 5, 1, 9, 0), LocalDateTime.of(2026, 5, 1, 17, 0));
        Shift earlier = shift(otherShiftId, LocalDateTime.of(2026, 5, 1, 6, 0), LocalDateTime.of(2026, 5, 1, 9, 0));

        ScheduleEntry otherEntry = new ScheduleEntry();
        otherEntry.setScheduleEntryId(UUID.randomUUID());
        otherEntry.setShiftId(otherShiftId);
        otherEntry.setUserId(userId);

        ScheduleEntry saved = new ScheduleEntry();
        saved.setScheduleEntryId(UUID.randomUUID());
        saved.setShiftId(targetShiftId);
        saved.setUserId(userId);

        when(shiftRepository.findById(targetShiftId)).thenReturn(Optional.of(target));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(project()));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(targetShiftId, userId)).thenReturn(Optional.empty());
        when(scheduleEntryRepository.findByUserId(userId)).thenReturn(List.of(otherEntry));
        when(shiftRepository.findById(otherShiftId)).thenReturn(Optional.of(earlier));
        when(scheduleEntryRepository.save(any(ScheduleEntry.class))).thenReturn(saved);

        assertDoesNotThrow(() -> service.createAssignment(companyId, targetShiftId, request()));
        verify(scheduleEntryRepository).save(any(ScheduleEntry.class));
    }

    private Shift shift(UUID id, LocalDateTime start, LocalDateTime end) {
        Shift s = new Shift();
        s.setShiftId(id);
        s.setProjectId(projectId);
        s.setStartTime(start);
        s.setEndTime(end);
        s.setFunctionName("BAR");
        return s;
    }

    private Project project() {
        Project p = new Project();
        p.setProjectId(projectId);
        p.setCompanyId(companyId);
        p.setName("Test project");
        p.setStartDate(LocalDate.of(2026, 5, 1));
        p.setEndDate(LocalDate.of(2026, 5, 1));
        p.setFinalized(false);
        return p;
    }

    private PlanningAssignmentSaveRequestDTO request() {
        PlanningAssignmentSaveRequestDTO request = new PlanningAssignmentSaveRequestDTO();
        request.setUserId(userId);
        request.setStatus(ScheduleEntryStatus.ASSIGNED);
        return request;
    }
}
