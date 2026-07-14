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
    private String note;
    private boolean workedForUsBefore;
    private boolean contactConsent;
    private boolean informationAccurate;
    private String profilePictureFileName;
    private String profilePictureContentType;
    private boolean hasProfilePicture;
    private String cvFileName;
    private String cvContentType;
    private String status;
    private String reviewNote;
    private String reviewedAt;
    private String reviewedByUserId;
    private Boolean decisionEmailSent;
    private String acceptedUserId;
    // Reapplication context (see JobApplicationService): whether this person has earlier
    // applications, how many, and the most recent prior decision + reviewer note, plus the
    // per-applicant reapply block.
    private boolean reapplicationBlocked;
    private boolean reapplicant;
    private int priorApplicationCount;
    private String priorDecision;
    private String priorReviewNote;
    private String priorDecisionAt;
    private String submittedAt;
    private String updatedAt;

    public String getApplicationId() {
        return applicationId;
    }

    public void setApplicationId(String applicationId) {
        this.applicationId = applicationId;
    }

    public String getFirstNames() {
        return firstNames;
    }

    public void setFirstNames(String firstNames) {
        this.firstNames = firstNames;
    }

    public String getPreferredName() {
        return preferredName;
    }

    public void setPreferredName(String preferredName) {
        this.preferredName = preferredName;
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

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(String dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getNationality() {
        return nationality;
    }

    public void setNationality(String nationality) {
        this.nationality = nationality;
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

    public String getRoleInterest() {
        return roleInterest;
    }

    public void setRoleInterest(String roleInterest) {
        this.roleInterest = roleInterest;
    }

    public String getContractPreference() {
        return contractPreference;
    }

    public void setContractPreference(String contractPreference) {
        this.contractPreference = contractPreference;
    }

    public String getAvailableFrom() {
        return availableFrom;
    }

    public void setAvailableFrom(String availableFrom) {
        this.availableFrom = availableFrom;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public boolean isWorkedForUsBefore() {
        return workedForUsBefore;
    }

    public void setWorkedForUsBefore(boolean workedForUsBefore) {
        this.workedForUsBefore = workedForUsBefore;
    }

    public boolean isContactConsent() {
        return contactConsent;
    }

    public void setContactConsent(boolean contactConsent) {
        this.contactConsent = contactConsent;
    }

    public boolean isInformationAccurate() {
        return informationAccurate;
    }

    public void setInformationAccurate(boolean informationAccurate) {
        this.informationAccurate = informationAccurate;
    }

    public String getProfilePictureFileName() {
        return profilePictureFileName;
    }

    public void setProfilePictureFileName(String profilePictureFileName) {
        this.profilePictureFileName = profilePictureFileName;
    }

    public String getProfilePictureContentType() {
        return profilePictureContentType;
    }

    public void setProfilePictureContentType(String profilePictureContentType) {
        this.profilePictureContentType = profilePictureContentType;
    }

    public boolean isHasProfilePicture() {
        return hasProfilePicture;
    }

    public void setHasProfilePicture(boolean hasProfilePicture) {
        this.hasProfilePicture = hasProfilePicture;
    }

    public String getCvFileName() {
        return cvFileName;
    }

    public void setCvFileName(String cvFileName) {
        this.cvFileName = cvFileName;
    }

    public String getCvContentType() {
        return cvContentType;
    }

    public void setCvContentType(String cvContentType) {
        this.cvContentType = cvContentType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public void setReviewNote(String reviewNote) {
        this.reviewNote = reviewNote;
    }

    public String getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(String reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewedByUserId() {
        return reviewedByUserId;
    }

    public void setReviewedByUserId(String reviewedByUserId) {
        this.reviewedByUserId = reviewedByUserId;
    }

    public Boolean getDecisionEmailSent() {
        return decisionEmailSent;
    }

    public void setDecisionEmailSent(Boolean decisionEmailSent) {
        this.decisionEmailSent = decisionEmailSent;
    }

    public String getAcceptedUserId() {
        return acceptedUserId;
    }

    public void setAcceptedUserId(String acceptedUserId) {
        this.acceptedUserId = acceptedUserId;
    }

    public boolean isReapplicationBlocked() {
        return reapplicationBlocked;
    }

    public void setReapplicationBlocked(boolean reapplicationBlocked) {
        this.reapplicationBlocked = reapplicationBlocked;
    }

    public boolean isReapplicant() {
        return reapplicant;
    }

    public void setReapplicant(boolean reapplicant) {
        this.reapplicant = reapplicant;
    }

    public int getPriorApplicationCount() {
        return priorApplicationCount;
    }

    public void setPriorApplicationCount(int priorApplicationCount) {
        this.priorApplicationCount = priorApplicationCount;
    }

    public String getPriorDecision() {
        return priorDecision;
    }

    public void setPriorDecision(String priorDecision) {
        this.priorDecision = priorDecision;
    }

    public String getPriorReviewNote() {
        return priorReviewNote;
    }

    public void setPriorReviewNote(String priorReviewNote) {
        this.priorReviewNote = priorReviewNote;
    }

    public String getPriorDecisionAt() {
        return priorDecisionAt;
    }

    public void setPriorDecisionAt(String priorDecisionAt) {
        this.priorDecisionAt = priorDecisionAt;
    }

    public String getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(String submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
