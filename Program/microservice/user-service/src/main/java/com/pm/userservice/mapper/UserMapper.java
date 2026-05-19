package com.pm.userservice.mapper;

import com.pm.userservice.dto.EmployeeTaxProfileDTO;
import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import user.events.UserRegisteredEvent;

import java.time.LocalDate;
import java.util.UUID;

public class UserMapper {
    public static UserResponseDTO toDTO(User user) {
        return toDTO(user, user != null ? user.getPayslipFrequencyMinutes() : null);
    }

    public static UserResponseDTO toDTO(User user, Integer payoutFrequencyMinutes) {
        if (user == null) {
            return null;
        }
        UserResponseDTO dto = new UserResponseDTO();
        dto.setUserId(user.getUserId() != null ? user.getUserId().toString() : null);
        dto.setEmail(user.getEmail());
        dto.setPreferredName(user.getPreferredName());
        dto.setFirstNames(user.getFirstNames());
        dto.setMiddleNamePrefix(user.getMiddleNamePrefix());
        dto.setLastName(user.getLastName());
        dto.setGender(user.getGender());
        dto.setDateOfBirth(user.getDateOfBirth() != null ? user.getDateOfBirth().toString() : null);
        dto.setMobileNumber(user.getMobileNumber());
        dto.setPosition(user.getPosition());
        dto.setWorkedForUsBefore(user.isWorkedForUsBefore());
        dto.setStreet(user.getStreet());
        dto.setHouseNumber(user.getHouseNumber());
        dto.setHouseNumberSuffix(user.getHouseNumberSuffix());
        dto.setPostalCode(user.getPostalCode());
        dto.setCity(user.getCity());
        dto.setCountry(user.getCountry());
        dto.setNationality(user.getNationality());
        dto.setIban(user.getIban());
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
        dto.setCompanyId(user.getCompanyId() != null ? user.getCompanyId().toString() : null);
        dto.setPayslipFrequencyMinutes(
                payoutFrequencyMinutes != null ? payoutFrequencyMinutes : user.getPayslipFrequencyMinutes()
        );
        dto.setRegisteredDate(user.getRegisteredDate() != null ? user.getRegisteredDate().toString() : null);
        dto.setStatus(user.getStatus() != null ? user.getStatus().name() : null);
        dto.setEmployeeTaxProfile(toEmployeeTaxProfile(user));
        dto.setOnboardingReviewDecision(user.getOnboardingReviewDecision());
        dto.setOnboardingReviewNote(user.getOnboardingReviewNote());
        dto.setHasIdDocumentImage(user.getIdDocumentImage() != null && user.getIdDocumentImage().length > 0);

        return dto;
    }

    public static User toModel(UserRequestDTO userRequestDTO) {
        if (userRequestDTO == null) {
            return null;
        }

        User user = new User();
        user.setEmail(userRequestDTO.getEmail());
        user.setPreferredName(userRequestDTO.getPreferredName());
        user.setFirstNames(userRequestDTO.getFirstNames());
        user.setMiddleNamePrefix(userRequestDTO.getMiddleNamePrefix());
        user.setLastName(userRequestDTO.getLastName());
        user.setGender(userRequestDTO.getGender());
        user.setDateOfBirth(userRequestDTO.getDateOfBirth() != null ? LocalDate.parse(userRequestDTO.getDateOfBirth()) : null);
        user.setMobileNumber(userRequestDTO.getMobileNumber());
        user.setStreet(userRequestDTO.getStreet());
        user.setHouseNumber(userRequestDTO.getHouseNumber());
        user.setHouseNumberSuffix(userRequestDTO.getHouseNumberSuffix());
        user.setPostalCode(userRequestDTO.getPostalCode());
        user.setCity(userRequestDTO.getCity());
        user.setCountry(userRequestDTO.getCountry());
        user.setIban(userRequestDTO.getIban());
        applyEmployeeTaxProfile(user, userRequestDTO.getEmployeeTaxProfile());

        return user;
    }

    public static User toModelUserRegisteredEvent(UserRegisteredEvent event) {
        if (event == null) {
            return null;
        }

        User user = new User();
        user.setUserId(UUID.fromString(event.getUserId()));
        user.setEmail(event.getEmail());
        user.setStatus(UserStatus.ACTIVE);
        user.setRegisteredDate(LocalDate.now());
        if (event.getCompanyId() != null && !event.getCompanyId().isBlank()) {
            user.setCompanyId(UUID.fromString(event.getCompanyId()));
        }

        return user;
    }

    public static void applyEmployeeTaxProfile(User user, EmployeeTaxProfileDTO employeeTaxProfile) {
        if (user == null || employeeTaxProfile == null) {
            return;
        }

        user.setBsn(employeeTaxProfile.getBsn());
        user.setApplyLoonheffingskorting(Boolean.TRUE.equals(employeeTaxProfile.getApplyLoonheffingskorting()));
        user.setPensionParticipant(Boolean.TRUE.equals(employeeTaxProfile.getPensionParticipant()));
        user.setSpecialZvwContribution(Boolean.TRUE.equals(employeeTaxProfile.getSpecialZvwContribution()));
        user.setPayrollNotes(employeeTaxProfile.getPayrollNotes());
    }

    public static EmployeeTaxProfileDTO toEmployeeTaxProfile(User user) {
        if (user == null) {
            return null;
        }

        EmployeeTaxProfileDTO employeeTaxProfile = new EmployeeTaxProfileDTO();
        employeeTaxProfile.setBsn(user.getBsn());
        employeeTaxProfile.setApplyLoonheffingskorting(user.isApplyLoonheffingskorting());
        employeeTaxProfile.setPensionParticipant(user.isPensionParticipant());
        employeeTaxProfile.setSpecialZvwContribution(user.isSpecialZvwContribution());
        employeeTaxProfile.setPayrollNotes(user.getPayrollNotes());
        return employeeTaxProfile;
    }
}
