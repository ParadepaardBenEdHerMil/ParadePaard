package com.pm.userservice.service.impl;

import com.pm.userservice.dto.LeaveRequestResponseDTO;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.LeaveRequest;
import com.pm.userservice.model.LeaveStatus;
import com.pm.userservice.model.LeaveType;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.LeaveRequestRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.service.LeaveRequestService;
import com.pm.userservice.testsupport.PostgresTestContainerConfig;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(properties = {
        "spring.sql.init.mode=never",
        "spring.kafka.listener.auto-startup=false",
        "jwt.secret=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
        "grpc.server.port=0"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PostgresTestContainerConfig.class)
class LeaveRequestServiceLazyMappingIntegrationTest {

    @Autowired
    private CompanyRepository companyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LeaveRequestRepository leaveRequestRepository;

    @Autowired
    private LeaveRequestService leaveRequestService;

    @Autowired
    private EntityManager entityManager;

    @Test
    void getAllLeaveRequestsMapsLazyUserAssociationAfterRepositoryReturns() {
        UUID companyId = UUID.fromString("40000000-0000-0000-0000-000000000004");
        UUID userId = UUID.fromString("50000000-0000-0000-0000-000000000005");
        UUID requestId = UUID.fromString("60000000-0000-0000-0000-000000000006");

        Company company = new Company();
        company.setId(companyId);
        company.setName("Lazy Mapping Co");
        companyRepository.saveAndFlush(company);

        User user = new User();
        user.setUserId(userId);
        user.setCompanyId(companyId);
        user.setEmail("lazy-mapping@example.test");
        user.setPreferredName("Lazy Mapper");
        userRepository.saveAndFlush(user);

        LeaveRequest request = new LeaveRequest();
        request.setRequestId(requestId);
        request.setUser(user);
        request.setType(LeaveType.VACATION);
        request.setStartDate(LocalDate.of(2026, 8, 3));
        request.setEndDate(LocalDate.of(2026, 8, 4));
        request.setHours(16);
        request.setReason("Summer break");
        request.setStatus(LeaveStatus.PENDING);
        leaveRequestRepository.saveAndFlush(request);
        entityManager.clear();

        List<LeaveRequestResponseDTO> requests = leaveRequestService.getAllLeaveRequests(companyId);

        assertEquals(1, requests.size());
        assertEquals(requestId.toString(), requests.getFirst().getRequestId());
        assertEquals(userId.toString(), requests.getFirst().getUserId());
        assertEquals("Lazy Mapper", requests.getFirst().getUserName());
    }
}
