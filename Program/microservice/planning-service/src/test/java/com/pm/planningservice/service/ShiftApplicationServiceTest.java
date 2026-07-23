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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ShiftApplicationServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private ShiftRepository shiftRepository;

    @Mock
    private ScheduleEntryRepository scheduleEntryRepository;

    @Mock
    private ShiftApplicationRepository shiftApplicationRepository;

    @InjectMocks
    private ShiftApplicationService shiftApplicationService;

    private final UUID companyId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @Test
    void getOpenShiftsReturnsUpcomingShiftsWithOpenSpots() {
        Project project = project(false);
        Shift openShift = shift(project, LocalDateTime.now().plusDays(2), 2);
        Shift pastShift = shift(project, LocalDateTime.now().minusDays(1), 2);

        when(projectRepository.findByCompanyIdOrderByStartDateAsc(companyId)).thenReturn(List.of(project));
        when(shiftRepository.findByProjectIdIn(anyCollection())).thenReturn(List.of(openShift, pastShift));
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of(countView(openShift.getShiftId(), 1)));
        when(scheduleEntryRepository.findByUserId(userId)).thenReturn(List.of());
        when(shiftApplicationRepository.findByUserId(userId)).thenReturn(List.of());

        List<OpenShiftDTO> result = shiftApplicationService.getOpenShifts(companyId, userId);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getShiftId()).isEqualTo(openShift.getShiftId());
        assertThat(result.get(0).getSpotsRemaining()).isEqualTo(1);
        assertThat(result.get(0).getApplied()).isFalse();
    }

    @Test
    void getOpenShiftsSkipsFinalizedProjects() {
        Project finalizedProject = project(true);
        when(projectRepository.findByCompanyIdOrderByStartDateAsc(companyId)).thenReturn(List.of(finalizedProject));

        assertThat(shiftApplicationService.getOpenShifts(companyId, userId)).isEmpty();
    }

    @Test
    void getOpenShiftsSkipsFullShiftsUnlessApplied() {
        Project project = project(false);
        Shift fullShift = shift(project, LocalDateTime.now().plusDays(2), 1);
        Shift fullAppliedShift = shift(project, LocalDateTime.now().plusDays(3), 1);
        ShiftApplication application = application(fullAppliedShift.getShiftId());

        when(projectRepository.findByCompanyIdOrderByStartDateAsc(companyId)).thenReturn(List.of(project));
        when(shiftRepository.findByProjectIdIn(anyCollection())).thenReturn(List.of(fullShift, fullAppliedShift));
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of(countView(fullShift.getShiftId(), 1), countView(fullAppliedShift.getShiftId(), 1)));
        when(scheduleEntryRepository.findByUserId(userId)).thenReturn(List.of());
        when(shiftApplicationRepository.findByUserId(userId)).thenReturn(List.of(application));

        List<OpenShiftDTO> result = shiftApplicationService.getOpenShifts(companyId, userId);

        // The full shift is hidden, but the one the user applied to stays
        // visible so the application can still be withdrawn.
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getShiftId()).isEqualTo(fullAppliedShift.getShiftId());
        assertThat(result.get(0).getApplied()).isTrue();
        assertThat(result.get(0).getSpotsRemaining()).isZero();
    }

    @Test
    void getOpenShiftsSkipsShiftsTheUserIsScheduledOn() {
        Project project = project(false);
        Shift scheduledShift = shift(project, LocalDateTime.now().plusDays(2), 3);
        ScheduleEntry entry = new ScheduleEntry();
        entry.setShiftId(scheduledShift.getShiftId());
        entry.setUserId(userId);
        entry.setStatus(ScheduleEntryStatus.ASSIGNED);

        when(projectRepository.findByCompanyIdOrderByStartDateAsc(companyId)).thenReturn(List.of(project));
        when(shiftRepository.findByProjectIdIn(anyCollection())).thenReturn(List.of(scheduledShift));
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of(countView(scheduledShift.getShiftId(), 1)));
        when(scheduleEntryRepository.findByUserId(userId)).thenReturn(List.of(entry));
        when(shiftApplicationRepository.findByUserId(userId)).thenReturn(List.of());

        assertThat(shiftApplicationService.getOpenShifts(companyId, userId)).isEmpty();
    }

    @Test
    void applySavesApplication() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        stubShiftLookup(project, shift);
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());
        when(shiftApplicationRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of(countView(shift.getShiftId(), 1)));
        when(shiftApplicationRepository.save(any(ShiftApplication.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OpenShiftDTO result = shiftApplicationService.apply(companyId, userId, shift.getShiftId());

        assertThat(result.getApplied()).isTrue();
        assertThat(result.getAppliedAt()).isNotNull();
        verify(shiftApplicationRepository).save(any(ShiftApplication.class));
    }

    @Test
    void applyToStartedShiftIsRejected() {
        Project project = project(false);
        // A full day in the past keeps the check timezone-proof: "now" is taken
        // in the project timezone (UTC), which may differ from the JVM clock.
        Shift shift = shift(project, LocalDateTime.now().minusDays(1), 2);
        stubShiftLookup(project, shift);

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already started");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void applyWhenAlreadyScheduledIsRejected() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        ScheduleEntry entry = new ScheduleEntry();
        entry.setShiftId(shift.getShiftId());
        entry.setUserId(userId);
        entry.setStatus(ScheduleEntryStatus.CONFIRMED);
        stubShiftLookup(project, shift);
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already scheduled");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void applyTwiceIsRejected() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        stubShiftLookup(project, shift);
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());
        when(shiftApplicationRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.of(application(shift.getShiftId())));

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already applied");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void applyToFullShiftIsRejected() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 1);
        stubShiftLookup(project, shift);
        when(scheduleEntryRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());
        when(shiftApplicationRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of(countView(shift.getShiftId(), 1)));

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fully staffed");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void applyToFinalizedProjectIsRejected() {
        Project project = project(true);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        stubShiftLookup(project, shift);

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no longer open");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void applyToShiftOfOtherCompanyIsRejected() {
        Project project = project(false);
        project.setCompanyId(UUID.randomUUID());
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        stubShiftLookup(project, shift);

        assertThatThrownBy(() -> shiftApplicationService.apply(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Shift not found");
        verify(shiftApplicationRepository, never()).save(any());
    }

    @Test
    void withdrawDeletesApplication() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        ShiftApplication application = application(shift.getShiftId());
        stubShiftLookup(project, shift);
        when(shiftApplicationRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.of(application));
        when(scheduleEntryRepository.countAssignmentsByShiftIdIn(anyCollection(), any(), any()))
                .thenReturn(List.of());

        OpenShiftDTO result = shiftApplicationService.withdraw(companyId, userId, shift.getShiftId());

        assertThat(result.getApplied()).isFalse();
        verify(shiftApplicationRepository).delete(application);
    }

    @Test
    void withdrawWithoutApplicationIsRejected() {
        Project project = project(false);
        Shift shift = shift(project, LocalDateTime.now().plusDays(2), 2);
        stubShiftLookup(project, shift);
        when(shiftApplicationRepository.findFirstByShiftIdAndUserId(shift.getShiftId(), userId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> shiftApplicationService.withdraw(companyId, userId, shift.getShiftId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not applied");
    }

    private Project project(boolean finalized) {
        Project project = new Project();
        project.setProjectId(UUID.randomUUID());
        project.setCompanyId(companyId);
        project.setName("Summer festival");
        project.setStartDate(LocalDate.now());
        project.setEndDate(LocalDate.now().plusDays(30));
        project.setProjectTimezone("UTC");
        project.setFinalized(finalized);
        return project;
    }

    private Shift shift(Project project, LocalDateTime startTime, int peopleNeeded) {
        Shift shift = new Shift();
        shift.setShiftId(UUID.randomUUID());
        shift.setProjectId(project.getProjectId());
        shift.setStartTime(startTime);
        shift.setEndTime(startTime.plusHours(8));
        shift.setFunctionName("Bartender");
        shift.setPeopleNeeded(peopleNeeded);
        return shift;
    }

    private ShiftApplication application(UUID shiftId) {
        ShiftApplication application = new ShiftApplication();
        application.setShiftApplicationId(UUID.randomUUID());
        application.setShiftId(shiftId);
        application.setUserId(userId);
        application.setAppliedAt(LocalDateTime.now().minusHours(2));
        return application;
    }

    private void stubShiftLookup(Project project, Shift shift) {
        when(shiftRepository.findById(shift.getShiftId())).thenReturn(Optional.of(shift));
        when(projectRepository.findById(project.getProjectId())).thenReturn(Optional.of(project));
    }

    private ScheduleEntryRepository.ShiftAssignmentCountView countView(UUID shiftId, long assigned) {
        return new ScheduleEntryRepository.ShiftAssignmentCountView() {
            @Override
            public UUID getShiftId() {
                return shiftId;
            }

            @Override
            public Long getAssignedCount() {
                return assigned;
            }

            @Override
            public Long getCheckedInCount() {
                return 0L;
            }
        };
    }
}
