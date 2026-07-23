package com.pm.planningservice.service;

import com.pm.planningservice.dto.PlanningAssignmentSaveRequestDTO;
import com.pm.planningservice.integration.AuditLogClient;
import com.pm.planningservice.model.Project;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * PL-8: once a planning project is finalized it is locked — assignments and shift
 * edits are rejected so pay already in flight cannot be silently altered.
 */
@ExtendWith(MockitoExtension.class)
class PlanningFinalizeLockTest {

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

    @InjectMocks
    private PlanningManagementService service;

    @Test
    void assignmentOnFinalizedProjectIsRejected() {
        UUID companyId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID shiftId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();

        Shift shift = new Shift();
        shift.setShiftId(shiftId);
        shift.setProjectId(projectId);
        shift.setStartTime(LocalDateTime.of(2026, 5, 1, 9, 0));
        shift.setEndTime(LocalDateTime.of(2026, 5, 1, 17, 0));
        shift.setFunctionName("BAR");

        Project finalized = new Project();
        finalized.setProjectId(projectId);
        finalized.setCompanyId(companyId);
        finalized.setName("Closed project");
        finalized.setStartDate(LocalDate.of(2026, 5, 1));
        finalized.setEndDate(LocalDate.of(2026, 5, 1));
        finalized.setFinalized(true);

        when(shiftRepository.findById(shiftId)).thenReturn(Optional.of(shift));
        when(projectRepository.findByProjectIdAndCompanyId(projectId, companyId)).thenReturn(Optional.of(finalized));

        PlanningAssignmentSaveRequestDTO request = new PlanningAssignmentSaveRequestDTO();
        request.setUserId(userId);
        request.setStatus(ScheduleEntryStatus.ASSIGNED);

        assertThatThrownBy(() -> service.createAssignment(companyId, shiftId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Finalized");

        verify(scheduleEntryRepository, never()).save(any());
    }
}
