package com.pm.userservice.mapper;

import com.pm.userservice.dto.JobApplicationRequestDTO;
import com.pm.userservice.dto.JobApplicationResponseDTO;
import com.pm.userservice.model.ApplicationStatus;
import com.pm.userservice.model.JobApplication;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.UUID;

public final class JobApplicationMapper {
    private static final DateTimeFormatter D = DateTimeFormatter.ISO_DATE;

    private JobApplicationMapper() {}

    public static JobApplication toNewEntity(JobApplicationRequestDTO dto) {
        JobApplication application = new JobApplication();
        application.setFirstNames(dto.getFirstNames());
        application.setPreferredName(dto.getPreferredName());
        application.setMiddleNamePrefix(dto.getMiddleNamePrefix());
        application.setLastName(dto.getLastName());
        application.setEmail(dto.getEmail());
        application.setPhoneNumber(dto.getPhoneNumber());
        application.setDateOfBirth(parseRequiredDate(dto.getDateOfBirth(), "date of birth"));
        application.setGender(dto.getGender());
        application.setNationality(dto.getNationality());
        application.setCity(dto.getCity());
        application.setCountry(dto.getCountry());
        application.setRoleInterest(dto.getRoleInterest());
        application.setContractPreference(dto.getContractPreference());
        application.setAvailableFrom(parseOptionalDate(dto.getAvailableFrom(), "available-from date"));
        application.setNote(dto.getNote());
        application.setWorkedForUsBefore(Boolean.TRUE.equals(dto.getWorkedForUsBefore()));
        application.setContactConsent(dto.isContactConsent());
        application.setInformationAccurate(dto.isInformationAccurate());
        application.setStatus(ApplicationStatus.APPLICATION_SUBMITTED);
        return application;
    }

    public static JobApplicationResponseDTO toDTO(JobApplication application) {
        JobApplicationResponseDTO dto = new JobApplicationResponseDTO();
        dto.setApplicationId(toString(application.getApplicationId()));
        dto.setFirstNames(application.getFirstNames());
        dto.setPreferredName(application.getPreferredName());
        dto.setMiddleNamePrefix(application.getMiddleNamePrefix());
        dto.setLastName(application.getLastName());
        dto.setEmail(application.getEmail());
        dto.setPhoneNumber(application.getPhoneNumber());
        dto.setDateOfBirth(toString(application.getDateOfBirth()));
        dto.setGender(application.getGender());
        dto.setNationality(application.getNationality());
        dto.setCity(application.getCity());
        dto.setCountry(application.getCountry());
        dto.setRoleInterest(application.getRoleInterest());
        dto.setContractPreference(application.getContractPreference());
        dto.setAvailableFrom(toString(application.getAvailableFrom()));
        dto.setNote(application.getNote());
        dto.setWorkedForUsBefore(application.isWorkedForUsBefore());
        dto.setContactConsent(application.isContactConsent());
        dto.setInformationAccurate(application.isInformationAccurate());
        dto.setProfilePictureFileName(application.getProfilePictureFileName());
        dto.setProfilePictureContentType(application.getProfilePictureContentType());
        dto.setHasProfilePicture(application.getProfilePictureBytes() != null && application.getProfilePictureBytes().length > 0);
        dto.setCvFileName(application.getCvFileName());
        dto.setCvContentType(application.getCvContentType());
        dto.setStatus(application.getStatus().name());
        dto.setReviewNote(application.getReviewNote());
        dto.setReviewedAt(toString(application.getReviewedAt()));
        dto.setReviewedByUserId(application.getReviewedByUserId());
        dto.setDecisionEmailSent(application.getDecisionEmailSent());
        dto.setAcceptedUserId(toString(application.getAcceptedUserId()));
        dto.setReapplicationBlocked(application.isReapplicationBlocked());
        dto.setSubmittedAt(toString(application.getSubmittedAt()));
        dto.setUpdatedAt(toString(application.getUpdatedAt()));
        return dto;
    }

    /**
     * Parses a required ISO date, turning a malformed value into a friendly, field-specific
     * message the applicant can act on (surfaced as a 400 by GlobalExceptionHandler) instead
     * of an opaque 500.
     */
    private static LocalDate parseRequiredDate(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new DateTimeParseException("Please enter your " + field + ".", value == null ? "" : value, 0);
        }
        return parseFriendly(value, field);
    }

    private static LocalDate parseOptionalDate(String value, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseFriendly(value, field);
    }

    private static LocalDate parseFriendly(String value, String field) {
        try {
            return LocalDate.parse(value, D);
        } catch (DateTimeParseException ex) {
            throw new DateTimeParseException(
                    "Please enter a valid " + field + " (day/month/year).", value, 0);
        }
    }

    private static String toString(LocalDate value) {
        return value == null ? null : value.toString();
    }

    private static String toString(OffsetDateTime value) {
        return value == null ? null : value.toString();
    }

    private static String toString(UUID value) {
        return value == null ? null : value.toString();
    }
}
