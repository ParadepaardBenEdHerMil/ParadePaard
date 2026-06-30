package com.pm.userservice.mapper;

import com.pm.userservice.dto.LeaveRequestCreateDTO;
import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

class LeaveRequestMapperTest {

    private LeaveRequestCreateDTO createDto(String type, String start, String end, Integer hours, String reason) {
        LeaveRequestCreateDTO dto = new LeaveRequestCreateDTO();
        dto.setType(type);
        dto.setStartDate(start);
        dto.setEndDate(end);
        dto.setHours(hours);
        dto.setReason(reason);
        return dto;
    }

    @Test
    void toNewEntityIsBornPendingAndCopiesFields() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        LeaveRequestCreateDTO dto = createDto("VACATION", "2026-07-01", "2026-07-05", 24, "Family holiday");

        LeaveRequest lr = LeaveRequestMapper.toNewEntity(user, dto);

        // A self-service leave request must never be created already-approved.
        assertEquals(LeaveStatus.PENDING, lr.getStatus());
        assertSame(user, lr.getUser());
        assertEquals(LeaveType.VACATION, lr.getType());
        assertEquals(LocalDate.of(2026, 7, 1), lr.getStartDate());
        assertEquals(LocalDate.of(2026, 7, 5), lr.getEndDate());
        assertEquals(24, lr.getHours());
        assertEquals("Family holiday", lr.getReason());
    }

    @Test
    void toDtoPrefersPreferredNameOverLegalName() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setPreferredName("Jantje");
        user.setFirstNames("Jan");
        user.setLastName("Jansen");

        LeaveRequestResponseDTO dto = LeaveRequestMapper.toDTO(buildRequest(user, LeaveStatus.APPROVED));

        assertEquals("Jantje", dto.getUserName());
        assertEquals("APPROVED", dto.getStatus());
    }

    @Test
    void toDtoBuildsFullNameWithPrefixWhenNoPreferredName() {
        User user = new User();
        user.setUserId(UUID.randomUUID());
        user.setFirstNames("Jan");
        user.setMiddleNamePrefix("van");
        user.setLastName("Dijk");

        LeaveRequestResponseDTO dto = LeaveRequestMapper.toDTO(buildRequest(user, LeaveStatus.PENDING));

        assertEquals("Jan van Dijk", dto.getUserName());
        assertEquals("PENDING", dto.getStatus());
    }

    private LeaveRequest buildRequest(User user, LeaveStatus status) {
        LeaveRequest lr = new LeaveRequest();
        lr.setRequestId(UUID.randomUUID());
        lr.setUser(user);
        lr.setType(LeaveType.VACATION);
        lr.setStartDate(LocalDate.of(2026, 7, 1));
        lr.setEndDate(LocalDate.of(2026, 7, 5));
        lr.setHours(24);
        lr.setReason("x");
        lr.setStatus(status);
        lr.setCreatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        lr.setUpdatedAt(OffsetDateTime.parse("2026-06-29T10:00:00Z"));
        return lr;
    }
}
