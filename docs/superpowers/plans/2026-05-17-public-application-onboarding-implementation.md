# Public Application Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public application form, permission-protected application review queue, accepted-applicant onboarding expansion, and keep the existing contract signing workflow as the final hiring step.

**Architecture:** Add application records to `user-service`, expose public submit and protected review endpoints, and add application permissions to `auth-service`. The React frontend gets a public `/apply` route, management application queue/detail screens, expanded onboarding form sections, service wrappers, permission navigation, and rundown documentation.

**Tech Stack:** Spring Boot 3.5, Java 21, JPA, Spring Security method permissions, PostgreSQL-compatible seed SQL, React 19, React Router, Axios, TypeScript, Vitest.

---

## File Structure

Backend application records:

- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/model/ApplicationStatus.java`
  - Enum for `APPLICATION_SUBMITTED`, `APPLICATION_DENIED`, and `APPLICATION_ACCEPTED`.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/model/JobApplication.java`
  - JPA entity for public applications, review status, CV bytes, decision metadata, and accepted onboarding user link.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/repository/JobApplicationRepository.java`
  - Repository queries for submitted applications and lookup by id.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationRequestDTO.java`
  - JSON request body for public application submission.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationResponseDTO.java`
  - Response body used by review queue/detail screens.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/ApplicationDecisionRequestDTO.java`
  - Accept/deny note body.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/JobApplicationMapper.java`
  - Maps entity to DTO and hides CV bytes from list/detail JSON.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/service/JobApplicationService.java`
  - Public submission, queue listing, accept, deny, accepted onboarding user creation, and CV download logic.
- Create `Program/microservice/user-service/src/main/java/com/pm/userservice/controller/JobApplicationController.java`
  - Public `/applications` submit endpoint and protected `/admin/applications` endpoints.
- Modify `Program/microservice/user-service/src/main/resources/data.sql`
  - Adds `job_applications` table and accepted-onboarding columns to `users`.

Backend accepted onboarding:

- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/model/User.java`
  - Adds nationality, bank account holder name, ID document fields, ID image bytes, emergency contact fields.
- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserSetupRequestDTO.java`
  - Adds accepted-onboarding fields.
- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserResponseDTO.java`
  - Exposes non-binary accepted-onboarding fields for management review.
- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/UserMapper.java`
  - Maps new fields to/from DTOs.
- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/service/OnboardingService.java`
  - Persists expanded setup fields and trims optional text.
- Modify `Program/microservice/user-service/src/main/java/com/pm/userservice/controller/OnboardingController.java`
  - Accepts ID document image upload for the signed-in onboarding user.

Auth and permissions:

- Modify `Program/microservice/auth-service/src/main/resources/data.sql`
  - Seeds `CAN_VIEW_APPLICATIONS` and `CAN_REVIEW_APPLICATIONS`, grants them to `ADMIN` and `SUPER_ADMIN`.
- Modify `Program/frontend/src/utils/permissionPolicy.ts`
  - Adds application permissions into management access and nav.
- Modify `Program/frontend/src/utils/managementSections.ts`
  - Places Applications under People.

Frontend services and pages:

- Modify `Program/frontend/src/services/user-service/Types.ts`
  - Adds application DTO types and expanded setup fields.
- Create `Program/frontend/src/services/user-service/Applications.ts`
  - Axios wrappers for public submit, protected list/detail, accept, deny, and CV download.
- Modify `Program/frontend/src/services/user-service/UserServices.ts`
  - Exports application service methods and types.
- Create `Program/frontend/src/pages/Application.tsx`
  - Public application form at `/apply`.
- Create `Program/frontend/src/pages/AdminApplications.tsx`
  - Protected queue at `/management/applications`.
- Create `Program/frontend/src/pages/AdminApplicationDetails.tsx`
  - Protected detail and decision page at `/management/applications/:applicationId`.
- Modify `Program/frontend/src/pages/Onboarding.tsx`
  - Expands from two-step address/IBAN to full accepted onboarding.
- Modify `Program/frontend/src/pages/AdminOnboardingReview.tsx`
  - Keeps profile/contract review focused on accepted applicants and existing statuses.
- Modify `Program/frontend/src/pages/Management.tsx`
  - Adds Applications card copy.
- Modify `Program/frontend/src/App.tsx`
  - Adds public `/apply` and protected application routes.
- Create or modify CSS in `Program/frontend/src/stylesheets/Application.css`, `Program/frontend/src/stylesheets/AdminApplications.css`, and `Program/frontend/src/stylesheets/Onboarding.css`.

Tests and docs:

- Create `Program/microservice/user-service/src/test/java/com/pm/userservice/JobApplicationServiceTest.java`.
- Create `Program/frontend/src/pages/Application.test.tsx`.
- Create `Program/frontend/src/pages/AdminApplications.test.tsx`.
- Modify `Program/frontend/src/pages/Onboarding.test.ts`.
- Modify `Project Plan/Rundown/ParadePaardRundown.tex`.

---

### Task 1: Backend Application Domain

**Files:**
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/model/ApplicationStatus.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/model/JobApplication.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/repository/JobApplicationRepository.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationRequestDTO.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationResponseDTO.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/ApplicationDecisionRequestDTO.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/JobApplicationMapper.java`
- Modify: `Program/microservice/user-service/src/main/resources/data.sql`
- Test: `Program/microservice/user-service/src/test/java/com/pm/userservice/UserStatusConstraintSqlTest.java`

- [ ] **Step 1: Add a seed SQL assertion for application table creation**

Add assertions to `UserStatusConstraintSqlTest.java` so the test fails until `data.sql` creates the table and statuses. Use H2-compatible table metadata checks:

```java
@Test
void dataSqlCreatesJobApplicationsTable() throws Exception {
    try (Connection connection = DriverManager.getConnection("jdbc:h2:mem:application_schema;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE", "sa", "");
         Statement statement = connection.createStatement()) {
        RunScript.execute(connection, new FileReader("src/main/resources/data.sql"));

        try (ResultSet columns = connection.getMetaData().getColumns(null, null, "job_applications", "status")) {
            assertThat(columns.next()).isTrue();
        }
    }
}
```

- [ ] **Step 2: Run the backend schema test to verify it fails**

Run: `cd Program/microservice/user-service; ./mvnw -Dtest=UserStatusConstraintSqlTest test`

Expected: FAIL because `job_applications` does not exist.

- [ ] **Step 3: Add the application status enum**

Create `ApplicationStatus.java`:

```java
package com.pm.userservice.model;

public enum ApplicationStatus {
    APPLICATION_SUBMITTED,
    APPLICATION_DENIED,
    APPLICATION_ACCEPTED
}
```

- [ ] **Step 4: Add the job application entity**

Create `JobApplication.java`:

```java
package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "job_applications")
public class JobApplication {
    @Id
    @GeneratedValue
    private UUID applicationId;

    @Column(nullable = false)
    private String firstNames;
    private String preferredName;
    private String middleNamePrefix;

    @Column(nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String phoneNumber;

    @Column(nullable = false)
    private LocalDate dateOfBirth;

    private String gender;
    private String nationality;
    private String city;
    private String country;
    private String roleInterest;
    private String contractPreference;
    private LocalDate availableFrom;

    @Column(length = 2000)
    private String availabilityNotes;

    @Column(nullable = false)
    private boolean workedForUsBefore;

    @Column(length = 4000)
    private String experience;

    @Column(length = 1000)
    private String languages;

    @Column(length = 2000)
    private String certificates;

    @Column(length = 4000)
    private String motivation;

    @Column(nullable = false)
    private boolean contactConsent;

    @Column(nullable = false)
    private boolean informationAccurate;

    private String cvFileName;
    private String cvContentType;
    private byte[] cvBytes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status = ApplicationStatus.APPLICATION_SUBMITTED;

    @Column(length = 4000)
    private String reviewNote;

    private OffsetDateTime reviewedAt;
    private String reviewedByUserId;
    private Boolean decisionEmailSent;
    private UUID acceptedUserId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private OffsetDateTime submittedAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private OffsetDateTime updatedAt;

    // Generate getters and setters for all fields.
}
```

Use IDE generation for getters and setters. Do not use Lombok because this project does not use it.

- [ ] **Step 5: Add the repository**

Create `JobApplicationRepository.java`:

```java
package com.pm.userservice.repository;

import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {
    List<JobApplication> findAllByStatusOrderBySubmittedAtDesc(ApplicationStatus status);
    boolean existsByEmailAndStatus(String email, ApplicationStatus status);
}
```

- [ ] **Step 6: Add DTOs**

Create `JobApplicationRequestDTO.java`:

```java
package com.pm.userservice.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class JobApplicationRequestDTO {
    @NotBlank private String firstNames;
    private String preferredName;
    private String middleNamePrefix;
    @NotBlank private String lastName;
    @Email @NotBlank private String email;
    @NotBlank private String phoneNumber;
    @NotBlank private String dateOfBirth;
    private String gender;
    private String nationality;
    private String city;
    private String country;
    @NotBlank private String roleInterest;
    @NotBlank private String contractPreference;
    private String availableFrom;
    private String availabilityNotes;
    @NotNull private Boolean workedForUsBefore;
    private String experience;
    private String languages;
    private String certificates;
    private String motivation;
    @AssertTrue private boolean contactConsent;
    @AssertTrue private boolean informationAccurate;

    // Generate getters and setters for all fields.
}
```

Create `JobApplicationResponseDTO.java`:

```java
package com.pm.userservice.dto;

public class JobApplicationResponseDTO {
    private String applicationId;
    private String firstNames;
    private String preferredName;
    private String middleNamePrefix;
    private String lastName;
    private String email;
    private String phoneNumber;
    private String dateOfBirth;
    private String gender;
    private String nationality;
    private String city;
    private String country;
    private String roleInterest;
    private String contractPreference;
    private String availableFrom;
    private String availabilityNotes;
    private Boolean workedForUsBefore;
    private String experience;
    private String languages;
    private String certificates;
    private String motivation;
    private Boolean contactConsent;
    private Boolean informationAccurate;
    private String cvFileName;
    private String cvContentType;
    private String status;
    private String reviewNote;
    private String reviewedAt;
    private String reviewedByUserId;
    private Boolean decisionEmailSent;
    private String acceptedUserId;
    private String submittedAt;
    private String updatedAt;

    // Generate getters and setters for all fields.
}
```

Create `ApplicationDecisionRequestDTO.java`:

```java
package com.pm.userservice.dto;

public class ApplicationDecisionRequestDTO {
    private String reviewNote;

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }
}
```

- [ ] **Step 7: Add the mapper**

Create `JobApplicationMapper.java`:

```java
package com.pm.userservice.mapper;

import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.model.JobApplication;

public class JobApplicationMapper {
    public static JobApplicationResponseDTO toDTO(JobApplication application) {
        if (application == null) return null;
        JobApplicationResponseDTO dto = new JobApplicationResponseDTO();
        dto.setApplicationId(application.getApplicationId() != null ? application.getApplicationId().toString() : null);
        dto.setFirstNames(application.getFirstNames());
        dto.setPreferredName(application.getPreferredName());
        dto.setMiddleNamePrefix(application.getMiddleNamePrefix());
        dto.setLastName(application.getLastName());
        dto.setEmail(application.getEmail());
        dto.setPhoneNumber(application.getPhoneNumber());
        dto.setDateOfBirth(application.getDateOfBirth() != null ? application.getDateOfBirth().toString() : null);
        dto.setGender(application.getGender());
        dto.setNationality(application.getNationality());
        dto.setCity(application.getCity());
        dto.setCountry(application.getCountry());
        dto.setRoleInterest(application.getRoleInterest());
        dto.setContractPreference(application.getContractPreference());
        dto.setAvailableFrom(application.getAvailableFrom() != null ? application.getAvailableFrom().toString() : null);
        dto.setAvailabilityNotes(application.getAvailabilityNotes());
        dto.setWorkedForUsBefore(application.isWorkedForUsBefore());
        dto.setExperience(application.getExperience());
        dto.setLanguages(application.getLanguages());
        dto.setCertificates(application.getCertificates());
        dto.setMotivation(application.getMotivation());
        dto.setContactConsent(application.isContactConsent());
        dto.setInformationAccurate(application.isInformationAccurate());
        dto.setCvFileName(application.getCvFileName());
        dto.setCvContentType(application.getCvContentType());
        dto.setStatus(application.getStatus() != null ? application.getStatus().name() : null);
        dto.setReviewNote(application.getReviewNote());
        dto.setReviewedAt(application.getReviewedAt() != null ? application.getReviewedAt().toString() : null);
        dto.setReviewedByUserId(application.getReviewedByUserId());
        dto.setDecisionEmailSent(application.getDecisionEmailSent());
        dto.setAcceptedUserId(application.getAcceptedUserId() != null ? application.getAcceptedUserId().toString() : null);
        dto.setSubmittedAt(application.getSubmittedAt() != null ? application.getSubmittedAt().toString() : null);
        dto.setUpdatedAt(application.getUpdatedAt() != null ? application.getUpdatedAt().toString() : null);
        return dto;
    }
}
```

- [ ] **Step 8: Add seed SQL for the application table**

Add this to `Program/microservice/user-service/src/main/resources/data.sql` near the other table setup:

```sql
CREATE TABLE IF NOT EXISTS job_applications (
    application_id UUID PRIMARY KEY,
    first_names VARCHAR(255) NOT NULL,
    preferred_name VARCHAR(255),
    middle_name_prefix VARCHAR(255),
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(255),
    nationality VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(255),
    role_interest VARCHAR(255),
    contract_preference VARCHAR(255),
    available_from DATE,
    availability_notes VARCHAR(2000),
    worked_for_us_before BOOLEAN NOT NULL DEFAULT FALSE,
    experience VARCHAR(4000),
    languages VARCHAR(1000),
    certificates VARCHAR(2000),
    motivation VARCHAR(4000),
    contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
    information_accurate BOOLEAN NOT NULL DEFAULT FALSE,
    cv_file_name VARCHAR(255),
    cv_content_type VARCHAR(255),
    cv_bytes BYTEA,
    status VARCHAR(64) NOT NULL DEFAULT 'APPLICATION_SUBMITTED',
    review_note VARCHAR(4000),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_user_id VARCHAR(255),
    decision_email_sent BOOLEAN,
    accepted_user_id UUID,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;
ALTER TABLE IF EXISTS job_applications ADD CONSTRAINT job_applications_status_check CHECK (status IN (
    'APPLICATION_SUBMITTED',
    'APPLICATION_DENIED',
    'APPLICATION_ACCEPTED'
));
```

- [ ] **Step 9: Run the backend schema test**

Run: `cd Program/microservice/user-service; ./mvnw -Dtest=UserStatusConstraintSqlTest test`

Expected: PASS.

- [ ] **Step 10: Commit backend application domain**

Run:

```bash
git add Program/microservice/user-service/src/main/java/com/pm/userservice/model/ApplicationStatus.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/model/JobApplication.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/repository/JobApplicationRepository.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationRequestDTO.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/dto/JobApplicationResponseDTO.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/dto/ApplicationDecisionRequestDTO.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/JobApplicationMapper.java \
        Program/microservice/user-service/src/main/resources/data.sql \
        Program/microservice/user-service/src/test/java/com/pm/userservice/UserStatusConstraintSqlTest.java
git commit -m "Add job application domain model"
```

---

### Task 2: Backend Application Service And Controller

**Files:**
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/service/JobApplicationService.java`
- Create: `Program/microservice/user-service/src/main/java/com/pm/userservice/controller/JobApplicationController.java`
- Create: `Program/microservice/user-service/src/test/java/com/pm/userservice/JobApplicationServiceTest.java`

- [ ] **Step 1: Write service tests for submit, deny, and accept**

Create `JobApplicationServiceTest.java`:

```java
package com.pm.userservice;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.service.JobApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JobApplicationServiceTest {
    private final JobApplicationRepository repository = mock(JobApplicationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuthServiceClient authServiceClient = mock(AuthServiceClient.class);
    private final JobApplicationService service = new JobApplicationService(repository, userRepository, authServiceClient);

    @Test
    void submitApplicationStoresSubmittedApplicationWithOptionalCv() throws Exception {
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> {
            JobApplication saved = invocation.getArgument(0);
            saved.setApplicationId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
            return saved;
        });

        JobApplicationRequestDTO request = validRequest();
        MockMultipartFile cv = new MockMultipartFile("cv", "cv.pdf", "application/pdf", "pdf".getBytes());

        var response = service.submit(request, cv);

        assertThat(response.getStatus()).isEqualTo("APPLICATION_SUBMITTED");
        assertThat(response.getCvFileName()).isEqualTo("cv.pdf");
        verify(repository).save(any(JobApplication.class));
    }

    @Test
    void denyApplicationStoresDecisionMetadata() {
        UUID id = UUID.fromString("22222222-2222-2222-2222-222222222222");
        JobApplication application = new JobApplication();
        application.setApplicationId(id);
        application.setStatus(ApplicationStatus.APPLICATION_SUBMITTED);
        when(repository.findById(id)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApplicationDecisionRequestDTO request = new ApplicationDecisionRequestDTO();
        request.setReviewNote("Not enough availability.");

        var response = service.deny(id, request, "manager-1");

        assertThat(response.getStatus()).isEqualTo("APPLICATION_DENIED");
        assertThat(response.getReviewNote()).isEqualTo("Not enough availability.");
        assertThat(response.getDecisionEmailSent()).isFalse();
    }

    @Test
    void acceptApplicationCreatesPendingSetupUser() {
        UUID id = UUID.fromString("33333333-3333-3333-3333-333333333333");
        JobApplication application = new JobApplication();
        application.setApplicationId(id);
        application.setEmail("ava@example.com");
        application.setFirstNames("Ava Maria");
        application.setLastName("Jansen");
        application.setDateOfBirth(LocalDate.of(2000, 1, 1));
        application.setPhoneNumber("0612345678");
        application.setRoleInterest("Bar");
        application.setWorkedForUsBefore(false);
        application.setStatus(ApplicationStatus.APPLICATION_SUBMITTED);
        AuthAdminOnboardUserResponseDTO authResponse = new AuthAdminOnboardUserResponseDTO();
        authResponse.setUserId("44444444-4444-4444-4444-444444444444");
        authResponse.setUsername("ava.jansen");
        authResponse.setTemporaryPassword("Temp123!");
        authResponse.setCompanyId("00000000-0000-0000-0000-000000000001");
        when(repository.findById(id)).thenReturn(Optional.of(application));
        when(repository.save(any(JobApplication.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(authServiceClient.adminOnboardUser(any(AuthAdminOnboardUserRequestDTO.class), any())).thenReturn(authResponse);

        var response = service.accept(id, new ApplicationDecisionRequestDTO(), "manager-1", "access-token");

        assertThat(response.getStatus()).isEqualTo("APPLICATION_ACCEPTED");
        assertThat(response.getAcceptedUserId()).isEqualTo("44444444-4444-4444-4444-444444444444");
        assertThat(response.getDecisionEmailSent()).isFalse();
        verify(userRepository).save(any(User.class));
    }

    private static JobApplicationRequestDTO validRequest() {
        JobApplicationRequestDTO request = new JobApplicationRequestDTO();
        request.setFirstNames("Ava Maria");
        request.setLastName("Jansen");
        request.setEmail("ava@example.com");
        request.setPhoneNumber("0612345678");
        request.setDateOfBirth(LocalDate.of(2000, 1, 1).toString());
        request.setRoleInterest("Bar");
        request.setContractPreference("On-call");
        request.setWorkedForUsBefore(false);
        request.setContactConsent(true);
        request.setInformationAccurate(true);
        return request;
    }
}
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `cd Program/microservice/user-service; ./mvnw -Dtest=JobApplicationServiceTest test`

Expected: FAIL because `JobApplicationService` does not exist.

- [ ] **Step 3: Implement `JobApplicationService`**

Create `JobApplicationService.java`:

```java
package com.pm.userservice.service;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.mapper.JobApplicationMapper;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.JobApplicationRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class JobApplicationService {
    private final JobApplicationRepository repository;
    private final UserRepository userRepository;
    private final AuthServiceClient authServiceClient;

    public JobApplicationService(
            JobApplicationRepository repository,
            UserRepository userRepository,
            AuthServiceClient authServiceClient
    ) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.authServiceClient = authServiceClient;
    }

    @Transactional
    public JobApplicationResponseDTO submit(JobApplicationRequestDTO request, MultipartFile cv) throws IOException {
        JobApplication application = new JobApplication();
        application.setFirstNames(StringUtils.trimToNull(request.getFirstNames()));
        application.setPreferredName(StringUtils.trimToNull(request.getPreferredName()));
        application.setMiddleNamePrefix(StringUtils.trimToNull(request.getMiddleNamePrefix()));
        application.setLastName(StringUtils.trimToNull(request.getLastName()));
        application.setEmail(StringUtils.trimToNull(request.getEmail()));
        application.setPhoneNumber(StringUtils.trimToNull(request.getPhoneNumber()));
        application.setDateOfBirth(LocalDate.parse(request.getDateOfBirth()));
        application.setGender(StringUtils.trimToNull(request.getGender()));
        application.setNationality(StringUtils.trimToNull(request.getNationality()));
        application.setCity(StringUtils.trimToNull(request.getCity()));
        application.setCountry(StringUtils.trimToNull(request.getCountry()));
        application.setRoleInterest(StringUtils.trimToNull(request.getRoleInterest()));
        application.setContractPreference(StringUtils.trimToNull(request.getContractPreference()));
        application.setAvailableFrom(StringUtils.isBlank(request.getAvailableFrom()) ? null : LocalDate.parse(request.getAvailableFrom()));
        application.setAvailabilityNotes(StringUtils.trimToNull(request.getAvailabilityNotes()));
        application.setWorkedForUsBefore(Boolean.TRUE.equals(request.getWorkedForUsBefore()));
        application.setExperience(StringUtils.trimToNull(request.getExperience()));
        application.setLanguages(StringUtils.trimToNull(request.getLanguages()));
        application.setCertificates(StringUtils.trimToNull(request.getCertificates()));
        application.setMotivation(StringUtils.trimToNull(request.getMotivation()));
        application.setContactConsent(request.isContactConsent());
        application.setInformationAccurate(request.isInformationAccurate());
        application.setStatus(ApplicationStatus.APPLICATION_SUBMITTED);
        if (cv != null && !cv.isEmpty()) {
            application.setCvFileName(cv.getOriginalFilename());
            application.setCvContentType(cv.getContentType());
            application.setCvBytes(cv.getBytes());
        }
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    @Transactional(readOnly = true)
    public List<JobApplicationResponseDTO> list() {
        return repository.findAll().stream()
                .sorted((left, right) -> right.getSubmittedAt().compareTo(left.getSubmittedAt()))
                .map(JobApplicationMapper::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public JobApplication getEntity(UUID applicationId) {
        return repository.findById(applicationId)
                .orElseThrow(() -> new IllegalArgumentException("Application " + applicationId + " not found"));
    }

    @Transactional(readOnly = true)
    public JobApplicationResponseDTO get(UUID applicationId) {
        return JobApplicationMapper.toDTO(getEntity(applicationId));
    }

    @Transactional
    public JobApplicationResponseDTO deny(UUID applicationId, ApplicationDecisionRequestDTO request, String reviewerUserId) {
        JobApplication application = getEntity(applicationId);
        applyDecision(application, ApplicationStatus.APPLICATION_DENIED, request, reviewerUserId);
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    @Transactional
    public JobApplicationResponseDTO accept(
            UUID applicationId,
            ApplicationDecisionRequestDTO request,
            String reviewerUserId,
            String accessToken
    ) {
        JobApplication application = getEntity(applicationId);
        UUID acceptedUserId = createPendingSetupUser(application, accessToken);
        application.setAcceptedUserId(acceptedUserId);
        applyDecision(application, ApplicationStatus.APPLICATION_ACCEPTED, request, reviewerUserId);
        return JobApplicationMapper.toDTO(repository.save(application));
    }

    private UUID createPendingSetupUser(JobApplication application, String accessToken) {
        AuthAdminOnboardUserRequestDTO authRequest = new AuthAdminOnboardUserRequestDTO();
        authRequest.setEmail(application.getEmail());
        authRequest.setFirstName(application.getFirstNames());
        authRequest.setLastName(buildAuthLastName(application));
        AuthAdminOnboardUserResponseDTO authResponse = authServiceClient.adminOnboardUser(authRequest, accessToken);
        UUID userId = UUID.fromString(authResponse.getUserId());

        User user = new User();
        user.setUserId(userId);
        user.setEmail(application.getEmail());
        user.setPreferredName(application.getPreferredName());
        user.setFirstNames(application.getFirstNames());
        user.setMiddleNamePrefix(application.getMiddleNamePrefix());
        user.setLastName(application.getLastName());
        user.setGender(application.getGender());
        user.setDateOfBirth(application.getDateOfBirth());
        user.setMobileNumber(application.getPhoneNumber());
        user.setPosition(application.getRoleInterest());
        user.setWorkedForUsBefore(application.isWorkedForUsBefore());
        user.setStatus(UserStatus.PENDING_SETUP);
        if (StringUtils.isNotBlank(authResponse.getCompanyId())) {
            user.setCompanyId(UUID.fromString(authResponse.getCompanyId()));
        }
        userRepository.save(user);
        return userId;
    }

    private static String buildAuthLastName(JobApplication application) {
        if (StringUtils.isBlank(application.getMiddleNamePrefix())) {
            return application.getLastName();
        }
        return application.getMiddleNamePrefix().trim() + " " + application.getLastName().trim();
    }

    private static void applyDecision(
            JobApplication application,
            ApplicationStatus status,
            ApplicationDecisionRequestDTO request,
            String reviewerUserId
    ) {
        application.setStatus(status);
        application.setReviewNote(request != null ? StringUtils.trimToNull(request.getReviewNote()) : null);
        application.setReviewedAt(OffsetDateTime.now());
        application.setReviewedByUserId(reviewerUserId);
        application.setDecisionEmailSent(false);
    }
}
```

- [ ] **Step 4: Implement the controller**

Create `JobApplicationController.java`:

```java
package com.pm.userservice.controller;

import com.pm.userservice.dto.ApplicationDecisionRequestDTO;
import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.model.JobApplication;
import com.pm.userservice.security.TokenExtractor;
import com.pm.userservice.service.JobApplicationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping
public class JobApplicationController {
    private final JobApplicationService service;

    public JobApplicationController(JobApplicationService service) {
        this.service = service;
    }

    @PostMapping(value = "/applications", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<JobApplicationResponseDTO> submit(
            @Valid @RequestPart("application") JobApplicationRequestDTO request,
            @RequestPart(value = "cv", required = false) MultipartFile cv
    ) throws IOException {
        return ResponseEntity.ok(service.submit(request, cv));
    }

    @GetMapping("/admin/applications")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS')")
    public ResponseEntity<List<JobApplicationResponseDTO>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/admin/applications/{applicationId}")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> get(@PathVariable UUID applicationId) {
        return ResponseEntity.ok(service.get(applicationId));
    }

    @GetMapping("/admin/applications/{applicationId}/cv")
    @PreAuthorize("hasAuthority('CAN_VIEW_APPLICATIONS')")
    public ResponseEntity<byte[]> downloadCv(@PathVariable UUID applicationId) {
        JobApplication application = service.getEntity(applicationId);
        if (application.getCvBytes() == null || application.getCvBytes().length == 0) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(application.getCvContentType() != null ? application.getCvContentType() : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + application.getCvFileName() + "\"")
                .body(application.getCvBytes());
    }

    @PostMapping("/admin/applications/{applicationId}/deny")
    @PreAuthorize("hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> deny(
            @PathVariable UUID applicationId,
            @RequestPart(value = "decision", required = false) ApplicationDecisionRequestDTO request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(service.deny(applicationId, request, authentication != null ? authentication.getName() : null));
    }

    @PostMapping("/admin/applications/{applicationId}/accept")
    @PreAuthorize("hasAuthority('CAN_REVIEW_APPLICATIONS')")
    public ResponseEntity<JobApplicationResponseDTO> accept(
            @PathVariable UUID applicationId,
            @RequestPart(value = "decision", required = false) ApplicationDecisionRequestDTO request,
            Authentication authentication,
            HttpServletRequest httpServletRequest
    ) {
        String accessToken = TokenExtractor.extractAccessToken(httpServletRequest);
        return ResponseEntity.ok(service.accept(
                applicationId,
                request,
                authentication != null ? authentication.getName() : null,
                accessToken
        ));
    }
}
```

- [ ] **Step 5: Simplify decision endpoints to JSON if multipart binding is not needed**

If Spring rejects `@RequestPart` for decision endpoints during tests, change both accept/deny methods to:

```java
public ResponseEntity<JobApplicationResponseDTO> deny(
        @PathVariable UUID applicationId,
        @RequestBody(required = false) ApplicationDecisionRequestDTO request,
        Authentication authentication
)
```

and add `import org.springframework.web.bind.annotation.RequestBody;`.

- [ ] **Step 6: Run backend service tests**

Run: `cd Program/microservice/user-service; ./mvnw -Dtest=JobApplicationServiceTest test`

Expected: PASS.

- [ ] **Step 7: Commit backend service and controller**

Run:

```bash
git add Program/microservice/user-service/src/main/java/com/pm/userservice/service/JobApplicationService.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/controller/JobApplicationController.java \
        Program/microservice/user-service/src/test/java/com/pm/userservice/JobApplicationServiceTest.java
git commit -m "Add job application API"
```

---

### Task 3: Permissions And Navigation Policy

**Files:**
- Modify: `Program/microservice/auth-service/src/main/resources/data.sql`
- Modify: `Program/frontend/src/utils/permissionPolicy.ts`
- Modify: `Program/frontend/src/utils/managementSections.ts`
- Test: `Program/frontend/src/utils/managementSections.test.ts`
- Test: `Program/frontend/src/utils/permissionPolicy.test.ts`

- [ ] **Step 1: Write failing frontend permission tests**

In `permissionPolicy.test.ts`, add:

```ts
import { canAccessManagement, getManagementNavItems } from "./permissionPolicy";

it("treats application permissions as management access", () => {
    expect(canAccessManagement(["CAN_VIEW_APPLICATIONS"])).toBe(true);
    expect(canAccessManagement(["CAN_REVIEW_APPLICATIONS"])).toBe(true);
});

it("adds Applications to management nav for application viewers", () => {
    const items = getManagementNavItems(["CAN_VIEW_APPLICATIONS"]);
    expect(items).toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Applications", to: "/management/applications" }),
    ]));
});
```

In `managementSections.test.ts`, add:

```ts
it("groups Applications under People", () => {
    const sections = buildManagementSections([
        { label: "Applications", to: "/management/applications", permissions: ["CAN_VIEW_APPLICATIONS"] },
    ]);

    expect(sections[0]).toMatchObject({
        key: "people",
        title: "People",
    });
});
```

- [ ] **Step 2: Run the focused frontend tests to verify they fail**

Run: `cd Program/frontend; npm test -- src/utils/permissionPolicy.test.ts src/utils/managementSections.test.ts`

Expected: FAIL because application permissions and nav are not defined.

- [ ] **Step 3: Add permissions to auth seed data**

In `Program/microservice/auth-service/src/main/resources/data.sql`, add permission inserts:

```sql
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_APPLICATIONS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_APPLICATIONS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REVIEW_APPLICATIONS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REVIEW_APPLICATIONS');
```

Add both permission names to the `ADMIN` permission list and rely on the existing `SUPER_ADMIN` cross join to receive them automatically.

- [ ] **Step 4: Add frontend permission policy entries**

Modify `permissionPolicy.ts`:

```ts
export const APPLICATION_REVIEW_PERMISSIONS = [
    "CAN_VIEW_APPLICATIONS",
    "CAN_REVIEW_APPLICATIONS",
];
```

Add `...APPLICATION_REVIEW_PERMISSIONS` to `MANAGEMENT_PERMISSIONS`.

Add this item to `MANAGEMENT_NAV_ITEMS` before Onboarding:

```ts
{
    label: "Applications",
    to: "/management/applications",
    permissions: APPLICATION_REVIEW_PERMISSIONS,
},
```

- [ ] **Step 5: Group Applications under People**

Modify `managementSections.ts`:

```ts
const SECTION_BY_LABEL: Record<string, ManagementSectionKey> = {
    Users: "people",
    Applications: "people",
    Onboarding: "people",
    "Onboarding review": "people",
    // keep existing entries
};
```

- [ ] **Step 6: Run focused frontend tests**

Run: `cd Program/frontend; npm test -- src/utils/permissionPolicy.test.ts src/utils/managementSections.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit permission wiring**

Run:

```bash
git add Program/microservice/auth-service/src/main/resources/data.sql \
        Program/frontend/src/utils/permissionPolicy.ts \
        Program/frontend/src/utils/managementSections.ts \
        Program/frontend/src/utils/permissionPolicy.test.ts \
        Program/frontend/src/utils/managementSections.test.ts
git commit -m "Add application review permissions"
```

---

### Task 4: Frontend Application Services

**Files:**
- Modify: `Program/frontend/src/services/user-service/Types.ts`
- Create: `Program/frontend/src/services/user-service/Applications.ts`
- Modify: `Program/frontend/src/services/user-service/UserServices.ts`

- [ ] **Step 1: Add TypeScript DTOs**

In `Types.ts`, add:

```ts
export type ApplicationStatus =
    | "APPLICATION_SUBMITTED"
    | "APPLICATION_DENIED"
    | "APPLICATION_ACCEPTED";

export type JobApplicationRequestDTO = {
    firstNames: string;
    preferredName?: string | null;
    middleNamePrefix?: string | null;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender?: string | null;
    nationality?: string | null;
    city?: string | null;
    country?: string | null;
    roleInterest: string;
    contractPreference: string;
    availableFrom?: string | null;
    availabilityNotes?: string | null;
    workedForUsBefore: boolean;
    experience?: string | null;
    languages?: string | null;
    certificates?: string | null;
    motivation?: string | null;
    contactConsent: boolean;
    informationAccurate: boolean;
};

export type JobApplicationResponseDTO = JobApplicationRequestDTO & {
    applicationId: string;
    cvFileName?: string | null;
    cvContentType?: string | null;
    status: ApplicationStatus | string;
    reviewNote?: string | null;
    reviewedAt?: string | null;
    reviewedByUserId?: string | null;
    decisionEmailSent?: boolean | null;
    acceptedUserId?: string | null;
    submittedAt?: string | null;
    updatedAt?: string | null;
};

export type ApplicationDecisionRequestDTO = {
    reviewNote?: string | null;
};
```

- [ ] **Step 2: Create Axios wrappers**

Create `Applications.ts`:

```ts
import axios from "axios";
import type {
    ApplicationDecisionRequestDTO,
    JobApplicationRequestDTO,
    JobApplicationResponseDTO,
} from "./Types";

export async function SubmitApplication(
    API_BASE_URL: string,
    payload: JobApplicationRequestDTO,
    cv?: File | null
): Promise<JobApplicationResponseDTO> {
    const formData = new FormData();
    formData.append("application", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (cv) formData.append("cv", cv);

    const response = await axios.post<JobApplicationResponseDTO>(
        `${API_BASE_URL}/api/applications`,
        formData,
        { withCredentials: true }
    );
    return response.data;
}

export async function GetApplications(API_BASE_URL: string): Promise<JobApplicationResponseDTO[]> {
    const response = await axios.get<JobApplicationResponseDTO[]>(`${API_BASE_URL}/api/admin/applications`, {
        withCredentials: true,
    });
    return response.data;
}

export async function GetApplication(
    API_BASE_URL: string,
    applicationId: string
): Promise<JobApplicationResponseDTO> {
    const response = await axios.get<JobApplicationResponseDTO>(
        `${API_BASE_URL}/api/admin/applications/${applicationId}`,
        { withCredentials: true }
    );
    return response.data;
}

export async function AcceptApplication(
    API_BASE_URL: string,
    applicationId: string,
    payload: ApplicationDecisionRequestDTO
): Promise<JobApplicationResponseDTO> {
    const response = await axios.post<JobApplicationResponseDTO>(
        `${API_BASE_URL}/api/admin/applications/${applicationId}/accept`,
        payload,
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
    );
    return response.data;
}

export async function DenyApplication(
    API_BASE_URL: string,
    applicationId: string,
    payload: ApplicationDecisionRequestDTO
): Promise<JobApplicationResponseDTO> {
    const response = await axios.post<JobApplicationResponseDTO>(
        `${API_BASE_URL}/api/admin/applications/${applicationId}/deny`,
        payload,
        { headers: { "Content-Type": "application/json" }, withCredentials: true }
    );
    return response.data;
}

export async function GetApplicationCv(API_BASE_URL: string, applicationId: string): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/api/admin/applications/${applicationId}/cv`, {
        responseType: "blob",
        withCredentials: true,
    });
    return response.data;
}
```

- [ ] **Step 3: Export service methods**

In `UserServices.ts`, import and export the new types and methods:

```ts
import {
    AcceptApplication,
    DenyApplication,
    GetApplication,
    GetApplicationCv,
    GetApplications,
    SubmitApplication,
} from "./Applications";
```

Add types to the type export list:

```ts
ApplicationDecisionRequestDTO,
JobApplicationRequestDTO,
JobApplicationResponseDTO,
```

Add methods to `UserServices`:

```ts
submitApplication: async (payload: JobApplicationRequestDTO, cv?: File | null): Promise<JobApplicationResponseDTO> => {
    return await SubmitApplication(API_BASE_URL, payload, cv);
},
getApplications: async (): Promise<JobApplicationResponseDTO[]> => {
    return await GetApplications(API_BASE_URL);
},
getApplication: async (applicationId: string): Promise<JobApplicationResponseDTO> => {
    return await GetApplication(API_BASE_URL, applicationId);
},
acceptApplication: async (
    applicationId: string,
    payload: ApplicationDecisionRequestDTO
): Promise<JobApplicationResponseDTO> => {
    return await AcceptApplication(API_BASE_URL, applicationId, payload);
},
denyApplication: async (
    applicationId: string,
    payload: ApplicationDecisionRequestDTO
): Promise<JobApplicationResponseDTO> => {
    return await DenyApplication(API_BASE_URL, applicationId, payload);
},
getApplicationCv: async (applicationId: string): Promise<Blob> => {
    return await GetApplicationCv(API_BASE_URL, applicationId);
},
```

- [ ] **Step 4: Type-check frontend**

Run: `cd Program/frontend; npm run build`

Expected: PASS.

- [ ] **Step 5: Commit frontend services**

Run:

```bash
git add Program/frontend/src/services/user-service/Types.ts \
        Program/frontend/src/services/user-service/Applications.ts \
        Program/frontend/src/services/user-service/UserServices.ts
git commit -m "Add application frontend services"
```

---

### Task 5: Public Application Page

**Files:**
- Create: `Program/frontend/src/pages/Application.tsx`
- Create: `Program/frontend/src/pages/Application.test.tsx`
- Create: `Program/frontend/src/stylesheets/Application.css`
- Modify: `Program/frontend/src/App.tsx`

- [ ] **Step 1: Write the public application page test**

Create `Application.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Application from "./Application";
import { UserServices } from "../services/user-service/UserServices";

vi.mock("../services/user-service/UserServices", () => ({
    UserServices: {
        submitApplication: vi.fn().mockResolvedValue({ applicationId: "app-1", status: "APPLICATION_SUBMITTED" }),
    },
}));

describe("Application", () => {
    it("submits a public application", async () => {
        render(<MemoryRouter><Application /></MemoryRouter>);

        await userEvent.type(screen.getByLabelText(/Full first names/i), "Ava Maria");
        await userEvent.type(screen.getByLabelText(/Surname/i), "Jansen");
        await userEvent.type(screen.getByLabelText(/Email address/i), "ava@example.com");
        await userEvent.type(screen.getByLabelText(/Phone number/i), "0612345678");
        await userEvent.type(screen.getByLabelText(/Date of birth/i), "01-01-2000");
        await userEvent.selectOptions(screen.getByLabelText(/Role interest/i), "Bar");
        await userEvent.selectOptions(screen.getByLabelText(/Contract preference/i), "On-call");
        await userEvent.click(screen.getByLabelText(/ParadePaard may contact me/i));
        await userEvent.click(screen.getByLabelText(/information is accurate/i));
        await userEvent.click(screen.getByRole("button", { name: /Submit application/i }));

        expect(UserServices.submitApplication).toHaveBeenCalled();
        expect(await screen.findByText(/Application submitted/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd Program/frontend; npm test -- src/pages/Application.test.tsx`

Expected: FAIL because `Application.tsx` does not exist.

- [ ] **Step 3: Implement the page**

Create `Application.tsx` with controlled fields and `UserServices.submitApplication`. Reuse `formatDateInput` and `parseDateToIso` logic from `AdminOnboarding.tsx` or extract it to a shared date utility if duplication grows.

Core submit logic:

```tsx
const payload = {
    firstNames: firstNames.trim(),
    preferredName: preferredName.trim() || null,
    middleNamePrefix: middleNamePrefix.trim() || null,
    lastName: lastName.trim(),
    email: email.trim(),
    phoneNumber: phoneNumber.trim(),
    dateOfBirth: dateOfBirthIso,
    gender: gender || null,
    nationality: nationality.trim() || null,
    city: city.trim() || null,
    country: country.trim() || null,
    roleInterest,
    contractPreference,
    availableFrom: availableFromIso || null,
    availabilityNotes: availabilityNotes.trim() || null,
    workedForUsBefore,
    experience: experience.trim() || null,
    languages: languages.trim() || null,
    certificates: certificates.trim() || null,
    motivation: motivation.trim() || null,
    contactConsent,
    informationAccurate,
};
await UserServices.submitApplication(payload, cvFile);
```

The visible form must include labels used by the test: Full first names, Surname, Email address, Phone number, Date of birth, Role interest, Contract preference, consent checkbox, accuracy checkbox, and Submit application.

- [ ] **Step 4: Add public route**

In `App.tsx`, import `Application` and add this route before protected routes:

```tsx
<Route path="/apply" element={<Application />} />
```

- [ ] **Step 5: Add CSS**

Create `Application.css` using restrained form styling. Keep it practical:

```css
.applicationPage {
    min-height: 100vh;
    background: #f6f7f9;
    color: #1f2933;
    padding: 32px 16px;
}

.applicationShell {
    max-width: 980px;
    margin: 0 auto;
}

.applicationForm {
    display: grid;
    gap: 18px;
}

.applicationSection {
    background: #ffffff;
    border: 1px solid #d9dee7;
    border-radius: 8px;
    padding: 20px;
}

.applicationGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}

@media (max-width: 720px) {
    .applicationGrid {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 6: Run the public application page test**

Run: `cd Program/frontend; npm test -- src/pages/Application.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit public application page**

Run:

```bash
git add Program/frontend/src/pages/Application.tsx \
        Program/frontend/src/pages/Application.test.tsx \
        Program/frontend/src/stylesheets/Application.css \
        Program/frontend/src/App.tsx
git commit -m "Add public application form"
```

---

### Task 6: Management Application Queue And Detail

**Files:**
- Create: `Program/frontend/src/pages/AdminApplications.tsx`
- Create: `Program/frontend/src/pages/AdminApplicationDetails.tsx`
- Create: `Program/frontend/src/pages/AdminApplications.test.tsx`
- Create: `Program/frontend/src/stylesheets/AdminApplications.css`
- Modify: `Program/frontend/src/pages/Management.tsx`
- Modify: `Program/frontend/src/App.tsx`

- [ ] **Step 1: Write queue test**

Create `AdminApplications.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminApplications from "./AdminApplications";

vi.mock("../components/Navbar", () => ({ default: () => <div /> }));
vi.mock("../components/PrimaryNav", () => ({ default: () => <div /> }));
vi.mock("../services/user-service/UserServices", () => ({
    UserServices: {
        getApplications: vi.fn().mockResolvedValue([
            {
                applicationId: "app-1",
                firstNames: "Ava",
                lastName: "Jansen",
                email: "ava@example.com",
                phoneNumber: "0612345678",
                roleInterest: "Bar",
                contractPreference: "On-call",
                status: "APPLICATION_SUBMITTED",
                submittedAt: "2026-05-17T10:00:00Z",
            },
        ]),
    },
}));

describe("AdminApplications", () => {
    it("shows submitted applications", async () => {
        render(<MemoryRouter><AdminApplications /></MemoryRouter>);

        expect(await screen.findByText(/Ava Jansen/i)).toBeInTheDocument();
        expect(screen.getByText(/Bar/i)).toBeInTheDocument();
        expect(screen.getByText(/Submitted/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run queue test to verify it fails**

Run: `cd Program/frontend; npm test -- src/pages/AdminApplications.test.tsx`

Expected: FAIL because page does not exist.

- [ ] **Step 3: Implement queue page**

Create `AdminApplications.tsx` with:

- `UserServices.getApplications()`
- loading/error/empty states
- table/list rows with applicant name, email, role, contract preference, status, submitted date
- row click to `/management/applications/:applicationId`

Status label helper:

```tsx
function applicationStatusLabel(status?: string | null): string {
    switch ((status ?? "").toUpperCase()) {
        case "APPLICATION_SUBMITTED":
            return "Submitted";
        case "APPLICATION_DENIED":
            return "Denied";
        case "APPLICATION_ACCEPTED":
            return "Accepted";
        default:
            return status ?? "-";
    }
}
```

- [ ] **Step 4: Implement detail page**

Create `AdminApplicationDetails.tsx` with:

- `UserServices.getApplication(applicationId)`
- full grouped application details
- review note textarea
- Accept application button calling `UserServices.acceptApplication`
- Deny application button calling `UserServices.denyApplication`
- CV download button when `cvFileName` exists
- success text showing new status and `decisionEmailSent`

Decision handler:

```tsx
const decide = async (action: "accept" | "deny") => {
    if (!applicationId) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading(action);
    try {
        const next = action === "accept"
            ? await UserServices.acceptApplication(applicationId, { reviewNote: reviewNote.trim() || null })
            : await UserServices.denyApplication(applicationId, { reviewNote: reviewNote.trim() || null });
        setApplication(next);
        setActionSuccess(action === "accept" ? "Application accepted." : "Application denied.");
    } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : "Application decision failed.");
    } finally {
        setActionLoading(null);
    }
};
```

- [ ] **Step 5: Add routes and management card copy**

In `App.tsx`, add imports and routes:

```tsx
import AdminApplications from "./pages/AdminApplications";
import AdminApplicationDetails from "./pages/AdminApplicationDetails";
```

```tsx
<Route
    path="/management/applications"
    element={
        <RequireActiveUser>
            <RequirePermission anyOf={["CAN_VIEW_APPLICATIONS", "CAN_REVIEW_APPLICATIONS"]}>
                <AdminApplications />
            </RequirePermission>
        </RequireActiveUser>
    }
/>
<Route
    path="/management/applications/:applicationId"
    element={
        <RequireActiveUser>
            <RequirePermission anyOf={["CAN_VIEW_APPLICATIONS", "CAN_REVIEW_APPLICATIONS"]}>
                <AdminApplicationDetails />
            </RequirePermission>
        </RequireActiveUser>
    }
/>
```

In `Management.tsx`, add card details:

```ts
Applications: {
    description: "Review public job applications and accept or deny applicants.",
    meta: "Application review",
},
```

- [ ] **Step 6: Add CSS**

Create `AdminApplications.css` with list layout consistent with `AdminLists.css`. Prefer existing classes where possible; only add narrow classes such as:

```css
.gridApplications {
    grid-template-columns: minmax(180px, 1.4fr) minmax(180px, 1.4fr) minmax(130px, 1fr) minmax(120px, 1fr) minmax(120px, .8fr) minmax(90px, .7fr);
}

.applicationDetailGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
}
```

- [ ] **Step 7: Run queue test**

Run: `cd Program/frontend; npm test -- src/pages/AdminApplications.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit management application screens**

Run:

```bash
git add Program/frontend/src/pages/AdminApplications.tsx \
        Program/frontend/src/pages/AdminApplicationDetails.tsx \
        Program/frontend/src/pages/AdminApplications.test.tsx \
        Program/frontend/src/stylesheets/AdminApplications.css \
        Program/frontend/src/pages/Management.tsx \
        Program/frontend/src/App.tsx
git commit -m "Add application review screens"
```

---

### Task 7: Expanded Accepted Onboarding Data

**Files:**
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/model/User.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserSetupRequestDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserResponseDTO.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/UserMapper.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/service/OnboardingService.java`
- Modify: `Program/microservice/user-service/src/main/java/com/pm/userservice/controller/OnboardingController.java`
- Modify: `Program/microservice/user-service/src/main/resources/data.sql`
- Modify: `Program/frontend/src/services/user-service/CompleteSetup.ts`
- Modify: `Program/frontend/src/services/user-service/UserServices.ts`
- Modify: `Program/frontend/src/services/user-service/Types.ts`

- [ ] **Step 1: Add setup service test coverage**

In `JobApplicationServiceTest` or a new `OnboardingServiceSetupTest`, add a focused unit test with mocked repositories verifying `completeUserSetup` stores `bankAccountHolderName`, `bsn`, `idDocumentType`, and emergency contact fields. If constructor dependencies make this noisy, create a narrow test around `UserMapper.applyEmployeeTaxProfile` and a service test with Mockito.

Expected assertion core:

```java
assertThat(savedUser.getBankAccountHolderName()).isEqualTo("Ava Jansen");
assertThat(savedUser.getBsn()).isEqualTo("123456789");
assertThat(savedUser.getIdDocumentType()).isEqualTo("Passport");
assertThat(savedUser.getEmergencyContactName()).isEqualTo("Mila Jansen");
assertThat(savedUser.getStatus()).isEqualTo(UserStatus.PENDING_PROFILE_REVIEW);
```

- [ ] **Step 2: Run backend onboarding test to verify it fails**

Run: `cd Program/microservice/user-service; ./mvnw -Dtest=OnboardingServiceSetupTest test`

Expected: FAIL because new fields do not exist.

- [ ] **Step 3: Add user entity fields**

Add fields/getters/setters to `User.java`:

```java
private String nationality;
private String bankAccountHolderName;
private String idDocumentType;
private String idDocumentNumber;
private LocalDate idIssueDate;
private LocalDate idExpirationDate;
private String idIssuingCountry;
private byte[] idDocumentImage;
private String idDocumentImageContentType;
private String emergencyContactName;
private String emergencyContactRelationship;
private String emergencyContactPhone;
private String emergencyContactEmail;
```

- [ ] **Step 4: Extend backend setup DTO**

Add to `UserSetupRequestDTO.java`:

```java
@NotBlank private String bankAccountHolderName;
@NotBlank private String bsn;
private Boolean applyLoonheffingskorting;
private Boolean pensionParticipant;
private Boolean specialZvwContribution;
private String payrollNotes;
private String nationality;
@NotBlank private String idDocumentType;
@NotBlank private String idDocumentNumber;
@NotBlank private String idIssueDate;
@NotBlank private String idExpirationDate;
@NotBlank private String idIssuingCountry;
@NotBlank private String emergencyContactName;
@NotBlank private String emergencyContactRelationship;
@NotBlank private String emergencyContactPhone;
private String emergencyContactEmail;
```

Generate getters and setters.

- [ ] **Step 5: Extend response DTO and mapper**

Add non-binary fields to `UserResponseDTO` and map them in `UserMapper.toDTO`. Do not expose `idDocumentImage` in normal user JSON.

Mapping example:

```java
dto.setNationality(user.getNationality());
dto.setBankAccountHolderName(user.getBankAccountHolderName());
dto.setIdDocumentType(user.getIdDocumentType());
dto.setIdDocumentNumber(user.getIdDocumentNumber());
dto.setIdIssueDate(user.getIdIssueDate() != null ? user.getIdIssueDate().toString() : null);
dto.setIdExpirationDate(user.getIdExpirationDate() != null ? user.getIdExpirationDate().toString() : null);
dto.setIdIssuingCountry(user.getIdIssuingCountry());
dto.setEmergencyContactName(user.getEmergencyContactName());
dto.setEmergencyContactRelationship(user.getEmergencyContactRelationship());
dto.setEmergencyContactPhone(user.getEmergencyContactPhone());
dto.setEmergencyContactEmail(user.getEmergencyContactEmail());
```

- [ ] **Step 6: Persist setup fields**

Modify `OnboardingService.completeUserSetup`:

```java
user.setNationality(request.getNationality());
user.setBankAccountHolderName(request.getBankAccountHolderName());
user.setBsn(request.getBsn());
user.setApplyLoonheffingskorting(Boolean.TRUE.equals(request.getApplyLoonheffingskorting()));
user.setPensionParticipant(Boolean.TRUE.equals(request.getPensionParticipant()));
user.setSpecialZvwContribution(Boolean.TRUE.equals(request.getSpecialZvwContribution()));
user.setPayrollNotes(request.getPayrollNotes());
user.setIdDocumentType(request.getIdDocumentType());
user.setIdDocumentNumber(request.getIdDocumentNumber());
user.setIdIssueDate(LocalDate.parse(request.getIdIssueDate()));
user.setIdExpirationDate(LocalDate.parse(request.getIdExpirationDate()));
user.setIdIssuingCountry(request.getIdIssuingCountry());
user.setEmergencyContactName(request.getEmergencyContactName());
user.setEmergencyContactRelationship(request.getEmergencyContactRelationship());
user.setEmergencyContactPhone(request.getEmergencyContactPhone());
user.setEmergencyContactEmail(request.getEmergencyContactEmail());
```

Add `import java.time.LocalDate;`.

- [ ] **Step 7: Add SQL columns**

In user-service `data.sql`, add:

```sql
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS nationality VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_number VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_issue_date DATE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_expiration_date DATE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_issuing_country VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_image BYTEA;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_image_content_type VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_email VARCHAR(255);
```

- [ ] **Step 8: Extend frontend setup types**

In `CompleteSetup.ts`, extend `UserSetupRequest` with the new fields:

```ts
bankAccountHolderName: string;
bsn: string;
applyLoonheffingskorting: boolean;
pensionParticipant: boolean;
specialZvwContribution: boolean;
payrollNotes?: string | null;
nationality?: string | null;
idDocumentType: string;
idDocumentNumber: string;
idIssueDate: string;
idExpirationDate: string;
idIssuingCountry: string;
emergencyContactName: string;
emergencyContactRelationship: string;
emergencyContactPhone: string;
emergencyContactEmail?: string | null;
```

In `Types.ts`, add the same non-binary fields to `UserResponseDTO`.

- [ ] **Step 9: Add ID image upload endpoint and service method**

In `OnboardingController.java`, add:

```java
@PostMapping(value = "/setup/id-document-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
@PreAuthorize("hasAuthority('CAN_COMPLETE_ONBOARDING')")
public ResponseEntity<Void> uploadIdDocumentImage(
        @RequestPart("file") MultipartFile file,
        Authentication authentication
) throws IOException {
    if (authentication == null || authentication.getName() == null) {
        return ResponseEntity.status(401).build();
    }
    UUID userId = UUID.fromString(authentication.getName());
    onboardingService.updateIdDocumentImage(userId, file.getBytes(), file.getContentType());
    return ResponseEntity.ok().build();
}
```

Add imports:

```java
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
```

In `OnboardingService.java`, add:

```java
@Transactional
public void updateIdDocumentImage(UUID userId, byte[] bytes, String contentType) {
    User user = userRepository.findByUserId(userId)
            .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));
    user.setIdDocumentImage(bytes);
    user.setIdDocumentImageContentType(contentType);
    userRepository.save(user);
}
```

In `CompleteSetup.ts`, add:

```ts
export async function UploadIdDocumentImage(API_BASE_URL: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(`${API_BASE_URL}/api/user/setup/id-document-image`, formData, {
        withCredentials: true,
    });
    if (response.status !== 200) {
        throw new Error("ID document upload failed with status: " + response.status);
    }
}
```

In `UserServices.ts`, expose:

```ts
uploadIdDocumentImage: async (file: File): Promise<void> => {
    return await UploadIdDocumentImage(API_BASE_URL, file);
},
```

- [ ] **Step 10: Run backend and frontend builds**

Run:

```bash
cd Program/microservice/user-service; ./mvnw test
cd ../../frontend; npm run build
```

Expected: PASS.

- [ ] **Step 11: Commit expanded setup data**

Run:

```bash
git add Program/microservice/user-service/src/main/java/com/pm/userservice/model/User.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserSetupRequestDTO.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/dto/UserResponseDTO.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/mapper/UserMapper.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/service/OnboardingService.java \
        Program/microservice/user-service/src/main/java/com/pm/userservice/controller/OnboardingController.java \
        Program/microservice/user-service/src/main/resources/data.sql \
        Program/frontend/src/services/user-service/CompleteSetup.ts \
        Program/frontend/src/services/user-service/UserServices.ts \
        Program/frontend/src/services/user-service/Types.ts
git commit -m "Expand accepted applicant onboarding data"
```

---

### Task 8: Expanded Onboarding UI

**Files:**
- Modify: `Program/frontend/src/pages/Onboarding.tsx`
- Modify: `Program/frontend/src/pages/Onboarding.test.ts`
- Modify: `Program/frontend/src/stylesheets/Onboarding.css`

- [ ] **Step 1: Update onboarding test for new sections**

Modify `Onboarding.test.ts` to assert that validation includes the new sections. Add expectations for visible text:

```ts
expect(screen.getByText(/Address/i)).toBeTruthy();
expect(screen.getByText(/Bank details/i)).toBeTruthy();
expect(screen.getByText(/Payroll and tax/i)).toBeTruthy();
expect(screen.getByText(/ID verification/i)).toBeTruthy();
expect(screen.getByText(/Emergency contact/i)).toBeTruthy();
```

- [ ] **Step 2: Run onboarding test to verify it fails**

Run: `cd Program/frontend; npm test -- src/pages/Onboarding.test.ts`

Expected: FAIL because the current UI only has Address and IBAN steps.

- [ ] **Step 3: Replace the two-step state with section state**

Use `type Step = 1 | 2 | 3 | 4 | 5;` with labels:

```ts
const stepLabels: Record<Step, string> = {
    1: "Address",
    2: "Bank details",
    3: "Payroll and tax",
    4: "ID verification",
    5: "Emergency contact",
};
```

Keep controlled fields for all setup request values. `canContinue` must validate only the current step.

- [ ] **Step 4: Submit expanded setup payload**

Build payload:

```ts
await UserServices.completeSetup({
    street,
    houseNumber,
    houseNumberSuffix: houseNumberSuffix || null,
    postalCode,
    city,
    country,
    iban,
    bankAccountHolderName,
    bsn,
    applyLoonheffingskorting,
    pensionParticipant,
    specialZvwContribution,
    payrollNotes: payrollNotes || null,
    nationality: nationality || null,
    idDocumentType,
    idDocumentNumber,
    idIssueDate: parseDateToIso(idIssueDate),
    idExpirationDate: parseDateToIso(idExpirationDate),
    idIssuingCountry,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactPhone,
    emergencyContactEmail: emergencyContactEmail || null,
});
if (idDocumentImage) {
    await UserServices.uploadIdDocumentImage(idDocumentImage);
}
```

The ID image file input is required on the ID verification step. If setup succeeds but the image upload fails, show the upload error and keep the user on onboarding so they can retry the document upload.

- [ ] **Step 5: Update CSS**

Extend `Onboarding.css` so the card handles more fields without crowding:

```css
.onboardingSectionTitle {
    margin: 0 0 12px;
    font-size: 1.1rem;
}

.onboardingCheckboxGrid {
    display: grid;
    gap: 10px;
}

.onboardingTextarea {
    min-height: 92px;
    resize: vertical;
}
```

- [ ] **Step 6: Run onboarding tests and build**

Run:

```bash
cd Program/frontend
npm test -- src/pages/Onboarding.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit onboarding UI**

Run:

```bash
git add Program/frontend/src/pages/Onboarding.tsx \
        Program/frontend/src/pages/Onboarding.test.ts \
        Program/frontend/src/stylesheets/Onboarding.css
git commit -m "Expand accepted applicant onboarding form"
```

---

### Task 9: Rundown, Full Verification, And Push

**Files:**
- Modify: `Project Plan/Rundown/ParadePaardRundown.tex`

- [ ] **Step 1: Update the rundown page descriptions**

In `ParadePaardRundown.tex`, update these sections:

- Employee Onboarding Page: describe the accepted-applicant private onboarding sections.
- Management Dashboard: mention Applications appears for application permissions.
- Management Employee Onboarding Page: clarify this is still direct invite/new employee setup.
- Management Onboarding Review Page: clarify it handles accepted onboarding/profile/contract review, not public applications.

Add new subsection near the onboarding pages:

```tex
\subsection{Public Application Page}

The Public Application Page lets a person apply to work for ParadePaard without logging in. The page collects basic personal details, contact details, work interest, contract preference, availability, experience, optional CV, and consent to be contacted. It does not collect sensitive payroll, bank, BSN, or ID information.

\subsection{Management Applications Page}

The Management Applications Page is a protected review queue for users with application permissions. It shows submitted applications with applicant details, role interest, contract preference, submitted date, and status. A reviewer can open an application, read the details, download the CV if present, accept the applicant, or deny the applicant.
```

- [ ] **Step 2: Add newest change log entry**

At the top of `\section*{Change Log}` item list, add:

```tex
    \item 2026 05 17: Added a public application form, application review screens, expanded accepted-applicant onboarding, and application permissions.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
cd Program/frontend
npm test
npm run build
cd ../microservice/user-service
./mvnw test
cd ../auth-service
./mvnw test
git status --short
```

Expected:

- Frontend tests pass.
- Frontend build passes.
- User-service tests pass.
- Auth-service tests pass.
- `git status --short` shows only intended changed files. Preserve the pre-existing unstaged `Program/frontend/package-lock.json` modification if it is still present and unrelated.

- [ ] **Step 4: Commit and push final implementation**

Run:

```bash
git add Program/microservice/user-service \
        Program/microservice/auth-service/src/main/resources/data.sql \
        Program/frontend/src \
        "Project Plan/Rundown/ParadePaardRundown.tex"
git commit -m "Add public application onboarding flow"
git push
```

Do not stage `Program/frontend/package-lock.json` unless the implementation intentionally changed dependencies.

---

## Self-Review

Spec coverage:

- Public application page: Task 5.
- Optional CV upload: Tasks 1, 2, 4, 5, 6.
- Protected application review queue/detail: Tasks 2, 3, 4, 6.
- Accept/deny actions with email result feedback: Tasks 2 and 6. First implementation records `decisionEmailSent=false` until real delivery is wired.
- Accepted applicant path: Task 2 creates a pending setup user through the existing auth admin-onboard endpoint and links it to the accepted application.
- Expanded accepted onboarding page, including ID image upload: Tasks 7 and 8.
- Route guards and permission-aware navigation: Tasks 3 and 6.
- Rundown update: Task 9.
- Existing contract flow preserved: Tasks avoid modifying contract service/signing except through final verification.

Known implementation note:

- The spec allows the first version to show email result feedback. This plan records the decision and explicitly returns `decisionEmailSent=false`; it does not wire real email delivery for application decisions yet. If real accept/deny emails are required in the same implementation pass, add a separate email-sender task before the final verification task.

Placeholder scan:

- The plan avoids unresolved placeholder work. The only generated-code instruction is getters/setters for Java DTO/entity fields, matching the existing codebase style and avoiding Lombok.

Type consistency:

- Backend status names match frontend `ApplicationStatus`.
- Service method names in `Applications.ts` match `UserServices.ts` exports.
- Permission names match the approved spec: `CAN_VIEW_APPLICATIONS` and `CAN_REVIEW_APPLICATIONS`.
