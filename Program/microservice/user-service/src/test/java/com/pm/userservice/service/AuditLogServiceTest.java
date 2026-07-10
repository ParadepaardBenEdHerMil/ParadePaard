package com.pm.userservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.model.AuditLogEntry;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.AuditLogEntryRepository;
import com.pm.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogServiceTest {

    @Mock
    private AuditLogEntryRepository auditLogEntryRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ObjectMapper objectMapper;

    @Test
    void recordIgnoresCallerSuppliedOccurredAtAndUsesServerClock() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();
        Clock clock = Clock.fixed(Instant.parse("2026-07-02T12:34:56Z"), ZoneOffset.UTC);
        OffsetDateTime forgedOccurredAt = OffsetDateTime.parse("1999-01-01T00:00:00Z");

        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setOccurredAt(forgedOccurredAt.toString());
        request.setCategory("user");
        request.setAction("updated");
        request.setEntityType("employee");

        when(userRepository.findByUserIdAndCompanyId(actorUserId, companyId)).thenReturn(Optional.empty());
        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(auditLogEntryRepository.save(any(AuditLogEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuditLogService service = service(clock);
        service.record(companyId, actorUserId, request);

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getOccurredAt()).isEqualTo(OffsetDateTime.now(clock));
    }

    @Test
    void recordBuildsActorDisplayNameWhenMiddleNamePrefixIsNull() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();

        // The reviewing admin has no preferred name and no middle-name prefix. displayName used to
        // build the label with List.of(...), which throws on the null prefix and aborted the whole
        // decision transaction. It must now cope with null name parts.
        User actor = new User();
        actor.setUserId(actorUserId);
        actor.setCompanyId(companyId);
        actor.setFirstNames("Benjamin");
        actor.setMiddleNamePrefix(null);
        actor.setLastName("van Rhee");

        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("APPLICATIONS");
        request.setAction("ACCEPTED");
        request.setEntityType("APPLICATION");

        when(userRepository.findByUserIdAndCompanyId(actorUserId, companyId)).thenReturn(Optional.of(actor));
        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(auditLogEntryRepository.save(any(AuditLogEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuditLogService service = service();
        service.record(companyId, actorUserId, request);

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getActorDisplayName()).isEqualTo("Benjamin van Rhee");
    }

    @Test
    void recordPreservesSurroundingWhitespaceBetweenMessageParts() throws Exception {
        UUID companyId = UUID.randomUUID();
        UUID actorUserId = UUID.randomUUID();

        // Actor has only an email, so the display name (and actor link label) is the email.
        User actor = new User();
        actor.setUserId(actorUserId);
        actor.setCompanyId(companyId);
        actor.setEmail("bevanrhee@gmail.com");

        // Callers embed the inter-word spacing inside the text parts (" updated ", " draft on ").
        // Trimming those parts used to collapse the summary to "...updatedwage rulesdraft on...".
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory("RULES");
        request.setAction("UPDATED");
        request.setEntityType("HORECA_RULE_SECTION");
        request.setMessageParts(List.of(
                textPart(" updated "),
                linkPart("wage rules"),
                textPart(" draft on "),
                linkPart("Horeca Payroll and Contract Rules")
        ));

        when(userRepository.findByUserIdAndCompanyId(actorUserId, companyId)).thenReturn(Optional.of(actor));
        when(userRepository.findByUserIdIn(any())).thenReturn(List.of());
        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(auditLogEntryRepository.save(any(AuditLogEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuditLogService service = service();
        service.record(companyId, actorUserId, request);

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(auditLogEntryRepository).save(captor.capture());
        assertThat(captor.getValue().getSummary())
                .isEqualTo("bevanrhee@gmail.com updated wage rules draft on Horeca Payroll and Contract Rules");
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO linkPart(String label) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setLabel(label);
        part.setRoute("/management/horeca-payroll-rules");
        return part;
    }

    @Test
    void listUsesSimpleCompanyQueryWhenNoOptionalFiltersArePresent() {
        UUID companyId = UUID.randomUUID();
        when(auditLogEntryRepository.findAllByCompanyIdOrderByOccurredAtDesc(
                eq(companyId),
                any(PageRequest.class)
        )).thenReturn(new PageImpl<>(List.of()));

        AuditLogService service = service();
        service.list(companyId, null, null, null, null, null, null, "   ", 0, 50);

        verify(auditLogEntryRepository).findAllByCompanyIdOrderByOccurredAtDesc(
                eq(companyId),
                any(PageRequest.class)
        );
        verify(auditLogEntryRepository, never()).findAll(any(Specification.class), any(PageRequest.class));
    }

    @Test
    void listUsesSpecificationQueryWhenAnyOptionalFilterIsPresent() {
        UUID companyId = UUID.randomUUID();
        when(auditLogEntryRepository.findAll(
                any(Specification.class),
                any(PageRequest.class)
        )).thenReturn(new PageImpl<>(List.of()));

        AuditLogService service = service();
        service.list(companyId, "PLANNING", "UPDATED", "SHIFT", null, null, null, "Alice", 0, 50);

        verify(auditLogEntryRepository).findAll(
                any(Specification.class),
                any(PageRequest.class)
        );
        verify(auditLogEntryRepository, never()).findAllByCompanyIdOrderByOccurredAtDesc(
                any(),
                any(PageRequest.class)
        );
    }

    private AuditLogService service() {
        return new AuditLogService(auditLogEntryRepository, userRepository, objectMapper);
    }

    private AuditLogService service(Clock clock) {
        return new AuditLogService(auditLogEntryRepository, userRepository, objectMapper, clock);
    }
}
