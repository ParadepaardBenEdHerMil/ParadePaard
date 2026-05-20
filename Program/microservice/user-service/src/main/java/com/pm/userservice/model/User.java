package com.pm.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.validation.constraints.Email;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "users_company_email_key", columnNames = {"company_id", "email"})
        }
)
public class User {
    @Id
    private UUID userId;

    @Email
    @Column
    private String email;

    private String preferredName;
    private String firstNames;
    private String middleNamePrefix;
    private String lastName;
    private String gender;
    private LocalDate dateOfBirth;
    private String mobileNumber;

    @Column(name = "position")
    private String position;

    @Column(name = "worked_for_us_before", nullable = false)
    private boolean workedForUsBefore = false;
    private String street;
    private String houseNumber;
    private String houseNumberSuffix;
    private String postalCode;
    private String city;
    private String country;
    private String nationality;
    private String iban;
    private String bankAccountHolderName;
    private String bsn;

    @Column(name = "apply_loonheffingskorting", nullable = false)
    @ColumnDefault("false")
    private boolean applyLoonheffingskorting = false;

    @Column(name = "pension_participant", nullable = false)
    @ColumnDefault("false")
    private boolean pensionParticipant = false;

    @Column(name = "special_zvw_contribution", nullable = false)
    @ColumnDefault("false")
    private boolean specialZvwContribution = false;

    @Column(name = "payroll_notes", length = 2000)
    private String payrollNotes;

    private String idDocumentType;
    private String idDocumentNumber;
    private LocalDate idIssueDate;
    private LocalDate idExpirationDate;
    private String idIssuingCountry;

    @Column(name = "id_document_image")
    private byte[] idDocumentImage;

    private String idDocumentImageContentType;
    private String emergencyContactName;
    private String emergencyContactRelationship;
    private String emergencyContactPhone;
    private String emergencyContactEmail;

    // Use a regular byte[] column to avoid PostgreSQL Large Object (OID) storage/streaming.
    // This column name intentionally differs from the previously introduced `profile_picture`
    // so existing databases (where that column may be OID) won't break reads of `/users/me`.
    @Column(name = "profile_picture_bytes")
    private byte[] profilePicture;

    @Column(name = "profile_picture_content_type")
    private String profilePictureContentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @ColumnDefault("'PENDING_SETUP'")
    private UserStatus status = UserStatus.PENDING_SETUP;

    @Column(name = "payslip_frequency_minutes", nullable = false)
    private Integer payslipFrequencyMinutes = 10080;

    @Column(name = "company_id", nullable = false)
    @ColumnDefault("'00000000-0000-0000-0000-000000000001'")
    private UUID companyId;

    @Column(name = "registered_date", nullable = false)
    @ColumnDefault("CURRENT_DATE")
    private LocalDate registeredDate = LocalDate.now();

    @Column(name = "onboarding_review_decision")
    private String onboardingReviewDecision;

    @Column(name = "onboarding_review_note", length = 2000)
    private String onboardingReviewNote;

    @Column(name = "onboarding_review_checked_sections_json", columnDefinition = "TEXT")
    private String onboardingReviewCheckedSectionsJson;

    @Column(name = "onboarding_review_contract_setup_json", columnDefinition = "TEXT")
    private String onboardingReviewContractSetupJson;

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPreferredName() {
        return preferredName;
    }

    public void setPreferredName(String preferredName) {
        this.preferredName = preferredName;
    }

    public String getFirstNames() {
        return firstNames;
    }

    public void setFirstNames(String firstNames) {
        this.firstNames = firstNames;
    }

    public String getMiddleNamePrefix() {
        return middleNamePrefix;
    }

    public void setMiddleNamePrefix(String middleNamePrefix) {
        this.middleNamePrefix = middleNamePrefix;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getMobileNumber() {
        return mobileNumber;
    }

    public void setMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public boolean isWorkedForUsBefore() {
        return workedForUsBefore;
    }

    public void setWorkedForUsBefore(boolean workedForUsBefore) {
        this.workedForUsBefore = workedForUsBefore;
    }

    public String getStreet() {
        return street;
    }

    public void setStreet(String street) {
        this.street = street;
    }

    public String getHouseNumber() {
        return houseNumber;
    }

    public void setHouseNumber(String houseNumber) {
        this.houseNumber = houseNumber;
    }

    public String getHouseNumberSuffix() {
        return houseNumberSuffix;
    }

    public void setHouseNumberSuffix(String houseNumberSuffix) {
        this.houseNumberSuffix = houseNumberSuffix;
    }

    public String getPostalCode() {
        return postalCode;
    }

    public void setPostalCode(String postalCode) {
        this.postalCode = postalCode;
    }

    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getNationality() {
        return nationality;
    }

    public void setNationality(String nationality) {
        this.nationality = nationality;
    }

    public String getIban() {
        return iban;
    }

    public void setIban(String iban) {
        this.iban = iban;
    }

    public String getBankAccountHolderName() {
        return bankAccountHolderName;
    }

    public void setBankAccountHolderName(String bankAccountHolderName) {
        this.bankAccountHolderName = bankAccountHolderName;
    }

    public String getBsn() {
        return bsn;
    }

    public void setBsn(String bsn) {
        this.bsn = bsn;
    }

    public boolean isApplyLoonheffingskorting() {
        return applyLoonheffingskorting;
    }

    public void setApplyLoonheffingskorting(boolean applyLoonheffingskorting) {
        this.applyLoonheffingskorting = applyLoonheffingskorting;
    }

    public boolean isPensionParticipant() {
        return pensionParticipant;
    }

    public void setPensionParticipant(boolean pensionParticipant) {
        this.pensionParticipant = pensionParticipant;
    }

    public boolean isSpecialZvwContribution() {
        return specialZvwContribution;
    }

    public void setSpecialZvwContribution(boolean specialZvwContribution) {
        this.specialZvwContribution = specialZvwContribution;
    }

    public String getPayrollNotes() {
        return payrollNotes;
    }

    public void setPayrollNotes(String payrollNotes) {
        this.payrollNotes = payrollNotes;
    }

    public String getIdDocumentType() {
        return idDocumentType;
    }

    public void setIdDocumentType(String idDocumentType) {
        this.idDocumentType = idDocumentType;
    }

    public String getIdDocumentNumber() {
        return idDocumentNumber;
    }

    public void setIdDocumentNumber(String idDocumentNumber) {
        this.idDocumentNumber = idDocumentNumber;
    }

    public LocalDate getIdIssueDate() {
        return idIssueDate;
    }

    public void setIdIssueDate(LocalDate idIssueDate) {
        this.idIssueDate = idIssueDate;
    }

    public LocalDate getIdExpirationDate() {
        return idExpirationDate;
    }

    public void setIdExpirationDate(LocalDate idExpirationDate) {
        this.idExpirationDate = idExpirationDate;
    }

    public String getIdIssuingCountry() {
        return idIssuingCountry;
    }

    public void setIdIssuingCountry(String idIssuingCountry) {
        this.idIssuingCountry = idIssuingCountry;
    }

    public byte[] getIdDocumentImage() {
        return idDocumentImage;
    }

    public void setIdDocumentImage(byte[] idDocumentImage) {
        this.idDocumentImage = idDocumentImage;
    }

    public String getIdDocumentImageContentType() {
        return idDocumentImageContentType;
    }

    public void setIdDocumentImageContentType(String idDocumentImageContentType) {
        this.idDocumentImageContentType = idDocumentImageContentType;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    public void setEmergencyContactName(String emergencyContactName) {
        this.emergencyContactName = emergencyContactName;
    }

    public String getEmergencyContactRelationship() {
        return emergencyContactRelationship;
    }

    public void setEmergencyContactRelationship(String emergencyContactRelationship) {
        this.emergencyContactRelationship = emergencyContactRelationship;
    }

    public String getEmergencyContactPhone() {
        return emergencyContactPhone;
    }

    public void setEmergencyContactPhone(String emergencyContactPhone) {
        this.emergencyContactPhone = emergencyContactPhone;
    }

    public String getEmergencyContactEmail() {
        return emergencyContactEmail;
    }

    public void setEmergencyContactEmail(String emergencyContactEmail) {
        this.emergencyContactEmail = emergencyContactEmail;
    }

    public byte[] getProfilePicture() {
        return profilePicture;
    }

    public void setProfilePicture(byte[] profilePicture) {
        this.profilePicture = profilePicture;
    }

    public String getProfilePictureContentType() {
        return profilePictureContentType;
    }

    public void setProfilePictureContentType(String profilePictureContentType) {
        this.profilePictureContentType = profilePictureContentType;
    }

    public UserStatus getStatus() {
        return status;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public Integer getPayslipFrequencyMinutes() {
        return payslipFrequencyMinutes;
    }

    public void setPayslipFrequencyMinutes(Integer payslipFrequencyMinutes) {
        this.payslipFrequencyMinutes = payslipFrequencyMinutes;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public LocalDate getRegisteredDate() {
        return registeredDate;
    }

    public void setRegisteredDate(LocalDate registeredDate) {
        this.registeredDate = registeredDate;
    }

    public String getOnboardingReviewDecision() {
        return onboardingReviewDecision;
    }

    public void setOnboardingReviewDecision(String onboardingReviewDecision) {
        this.onboardingReviewDecision = onboardingReviewDecision;
    }

    public String getOnboardingReviewNote() {
        return onboardingReviewNote;
    }

    public void setOnboardingReviewNote(String onboardingReviewNote) {
        this.onboardingReviewNote = onboardingReviewNote;
    }

    public String getOnboardingReviewCheckedSectionsJson() {
        return onboardingReviewCheckedSectionsJson;
    }

    public void setOnboardingReviewCheckedSectionsJson(String onboardingReviewCheckedSectionsJson) {
        this.onboardingReviewCheckedSectionsJson = onboardingReviewCheckedSectionsJson;
    }

    public String getOnboardingReviewContractSetupJson() {
        return onboardingReviewContractSetupJson;
    }

    public void setOnboardingReviewContractSetupJson(String onboardingReviewContractSetupJson) {
        this.onboardingReviewContractSetupJson = onboardingReviewContractSetupJson;
    }
}
