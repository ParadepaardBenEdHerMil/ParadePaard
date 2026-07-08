package com.pm.userservice.repository;

import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobApplicationRepository extends JpaRepository<JobApplication, UUID> {
    List<JobApplication> findAllByStatusOrderBySubmittedAtDesc(ApplicationStatus status);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmailAndStatus(String email, ApplicationStatus status);

    // Removes the application(s) an accepted user was onboarded from, so deleting the user also
    // frees their email for a fresh application instead of leaving an orphaned "accepted" row.
    long deleteByAcceptedUserId(UUID acceptedUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select application from JobApplication application where application.applicationId = :applicationId")
    Optional<JobApplication> findByApplicationIdForUpdate(@Param("applicationId") UUID applicationId);
}
