package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.integration.UserLeaveGrpcClient;
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
import com.pm.planningservice.repository.ShiftApplicationRepository;
import com.pm.planningservice.repository.ShiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * PL-4 (leave ↔ roster): an employee on approved leave cannot be rostered onto a shift that day.
 * The check calls user-service over gRPC; here that client is mocked.
 */
@ExtendWith(MockitoExtension.class)
class PlanningLeaveConflictTest {

    @Mock private ClientCompanyRepository clientCompanyRepository;
    @Mock private PlanningLocationRepository planningLocationRepository;
    @Mock private PlanningClientLocationUsageRepository planningClientLocationUsageRepository;
    @Mock private ProjectRepository projectRepository;
    @Mock private ShiftRepository shiftRepository;
    @Mock private ScheduleEntryRepository scheduleEntryRepository;
    @Mock private ShiftApplicationRepository shiftApplicationRepository;
    @Mock private ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;
    @Mock private ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;
    @Mock private AuditLogClient auditLogClient;
    @Mock private UserLeaveGrpcClient userLeaveClient;

    @InjectMocks
    private PlanningManagementService service;

    @BeforeEach
    void injectLeaveClient() {
        // userLeaveClient is an @Autowired(required=false) field, which @InjectMocks (constructor
        // injection) does not populate — inject the mock directly.
        ReflectionTestUtils.setField(service, "userLeaveClient", userLeaveClient);
    }

    private final UUID company = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    private Shift shift(UUID id) {
        Shift s = new Shift();
        s.setShiftId(id);
        s.setProjectId(projectId);
        s.setStartTime(LocalDateTime.of(2026, 5, 1, 9, 0));
        s.setEndTime(LocalDateTime.of(2026, 5, 1, 17, 0));
        s.setFunctionName("BAR");
        return s;
    }

    private Project project() {
        Project p = new Project();
        p.setProjectId(projectId);
        p.setCompanyId(company);
        p.setName("Test project");
        p.setStartDate(LocalDate.of(2026, 5, 1));
        p.setEndDate(LocalDate.of(2026, 5, 1));
        p.setFinalized(false);
        return p;
    }

    private PlanningAssignmentSaveRequestDTO request() {
        PlanningAssignmentSaveRequestDTO r = new PlanningAssignmentSaveRequestDTO();
        r.setUserId(userId);
        r.setStatus(ScheduleEntryStatus.ASSIGNED);
        return r;
    }

    @Test
    void assignmentRejectedWhenEmployeeIsOnApprovedLeave() {
        UUID shiftId = UUID.randomUUID();
        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift(shiftId)));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, company)).thenReturn(Optional.of(project()));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)).thenReturn(Optional.empty());
        when(userLeaveClient.hasApprovedLeaveOverlap(eq(userId.toString()), any(), any())).thenReturn(true);

        assertThatThrownBy(() -> service.createAssignment(company, shiftId, request()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("approved leave");

        verify(scheduleEntryRepository, never()).save(any());
    }

    @Test
    void assignmentAllowedWhenEmployeeIsNotOnLeave() {
        UUID shiftId = UUID.randomUUID();
        ScheduleEntry saved = new ScheduleEntry();
        saved.setScheduleEntryId(UUID.randomUUID());
        saved.setShiftId(shiftId);
        saved.setUserId(userId);
        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift(shiftId)));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, company)).thenReturn(Optional.of(project()));
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shiftId, userId)).thenReturn(Optional.empty());
        when(userLeaveClient.hasApprovedLeaveOverlap(eq(userId.toString()), any(), any())).thenReturn(false);
        when(scheduleEntryRepository.save(any(ScheduleEntry.class))).thenReturn(saved);

        assertDoesNotThrow(() -> service.createAssignment(company, shiftId, request()));
        verify(scheduleEntryRepository).save(any(ScheduleEntry.class));
    }
}
