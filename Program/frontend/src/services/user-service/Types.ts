export type LeaveType = "VACATION" | "SICK" | "UNPAID" | "PARENTAL" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
export type ApplicationStatus =
    | "APPLICATION_SUBMITTED"
    | "APPLICATION_DENIED"
    | "APPLICATION_ACCEPTED";

export type EmployeeTaxProfileDTO = {
    bsn?: string | null;
    applyLoonheffingskorting?: boolean | null;
    pensionParticipant?: boolean | null;
    specialZvwContribution?: boolean | null;
    payrollNotes?: string | null;
};

export type PayrollTaxTemplateDTO = {
    code: string;
    label: string;
    category: string;
    calculationType: "FIXED_AMOUNT" | "PERCENT_OF_GROSS" | string;
    configuredValue?: number | null;
    active?: boolean | null;
    sortOrder?: number | null;
    notes?: string | null;
    employeeProfileTrigger?: string | null;
};

export type PayrollDeductionLineDTO = {
    id: string;
    code: string;
    label: string;
    category: string;
    calculationType: "FIXED_AMOUNT" | "PERCENT_OF_GROSS" | string;
    configuredValue?: number | null;
    calculatedAmount?: number | null;
    manualAmountOverride?: number | null;
    source?: "COMPANY_DEFAULT" | "MANUAL" | string | null;
    notes?: string | null;
    sortOrder?: number | null;
};

export type HorecaRuleItemDTO = {
    id?: string | null;
    sectionKey?: string | null;
    itemKey: string;
    name: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    valueType?: "TEXT" | "NUMBER" | "BOOLEAN" | string | null;
    unit?: string | null;
    calculationRule?: string | null;
    documentName?: string | null;
    documentUrl?: string | null;
    pageReference?: string | null;
    functionGroup?: string | null;
    ageGroup?: string | null;
    sourceNote?: string | null;
    usedInContract?: boolean | null;
    usedInPayroll?: boolean | null;
    sortOrder?: number | null;
};

export type HorecaJobPresetConfigDTO = {
    id?: string | null;
    presetKey?: string | null;
    presetName: string;
    jobTitle: string;
    jobFunction: string;
    functionGroup: string;
    defaultContractType: string;
    defaultHourlyWage: number;
    defaultMonthlyWage?: number | null;
    defaultHoursPerWeek?: number | null;
    defaultPayrollPeriod: string;
    pensionApplicable?: boolean | null;
    holidayAllowanceMode?: string | null;
    vacationBuildUpApplicable?: boolean | null;
    documentName?: string | null;
    documentUrl?: string | null;
    pageReference?: string | null;
    sourceNote?: string | null;
    active?: boolean | null;
    adminNotes?: string | null;
    sortOrder?: number | null;
};

export type HorecaRuleVersionDTO = {
    versionId: string;
    companyId: string;
    versionLabel?: string | null;
    status: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
    reason?: string | null;
    sourceSummary?: string | null;
    publishedAt?: string | null;
    publishedByUserId?: string | null;
    sections: Record<string, HorecaRuleItemDTO[]>;
    jobPresets: HorecaJobPresetConfigDTO[];
};

export type HorecaRuleSectionUpdateDTO = {
    items: HorecaRuleItemDTO[];
};

export type HorecaJobPresetUpdateDTO = {
    jobPresets: HorecaJobPresetConfigDTO[];
};

export type HorecaRulePublishRequestDTO = {
    effectiveFrom: string;
    versionLabel?: string | null;
    reason?: string | null;
};

export type AuditLogMessagePartDTO = {
    type: "TEXT" | "LINK" | string;
    text?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    label?: string | null;
    route?: string | null;
};

export type AuditLogEntryDTO = {
    entryId: string;
    companyId: string;
    occurredAt: string;
    category: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    actorUserId?: string | null;
    actorDisplayName?: string | null;
    summary: string;
    messageParts: AuditLogMessagePartDTO[];
};

export type AuditLogQuery = {
    category?: string | null;
    action?: string | null;
    entityType?: string | null;
    actorUserId?: string | null;
    occurredFrom?: string | null;
    occurredTo?: string | null;
    query?: string | null;
    page?: number;
    size?: number;
};

export type OnboardingReviewContractSetupDraftDTO = {
    selectedFunctionId?: string | null;
    caoId?: string | null;
    jobPresetId?: string | null;
    jobTitle?: string | null;
    jobFunction?: string | null;
    functionGroup?: string | null;
    functionName?: string | null;
    contractType?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    grossHourlyWage?: string | null;
    grossMonthlyWage?: string | null;
    hoursPerWeek?: string | null;
    payrollPeriod?: string | null;
    workLocation?: string | null;
    loonheffingskorting?: "" | "YES" | "NO" | null;
    pensionApplicable?: "" | "YES" | "NO" | null;
    holidayAllowanceMode?: "RESERVED" | "PAID_EACH_PERIOD" | string | null;
    vacationBuildUpApplicable?: boolean | null;
    isManualWageOverride?: boolean | null;
    manualWageOverrideReason?: string | null;
    payrollBillingRate?: string | null;
    awfType?: "LOW" | "HIGH" | string | null;
    aofType?: "LOW" | "HIGH" | string | null;
    whkSector?: string | null;
    zvwApplicable?: boolean | null;
    paymentFrequency?: string | null;
    travelAllowance?: boolean | null;
    employerAgreementChecked?: boolean | null;
    employerTypedSignatureName?: string | null;
    employerDrawnSignatureImage?: string | null;
};

export type UserResponseDTO = {
    userId: string;
    email: string;
    preferredName: string | null;
    firstNames: string | null;
    middleNamePrefix: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    mobileNumber: string | null;
    position: string | null;
    workedForUsBefore: boolean | null;
    street: string | null;
    houseNumber: string | null;
    houseNumberSuffix: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    nationality?: string | null;
    iban: string | null;
    bankAccountHolderName?: string | null;
    idDocumentType?: string | null;
    idDocumentNumber?: string | null;
    idIssueDate?: string | null;
    idExpirationDate?: string | null;
    idIssuingCountry?: string | null;
    emergencyContactName?: string | null;
    emergencyContactRelationship?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactEmail?: string | null;
    companyId?: string | null;
    payslipFrequencyMinutes?: number | null;
    registeredDate?: string | null;
    status:
        | "PENDING_SETUP"
        | "PENDING_PROFILE_REVIEW"
        | "CHANGES_REQUESTED"
        | "PENDING_CONTRACT_SIGNATURE"
        | "PENDING_CONTRACT_REVIEW"
        | "ACTIVE"
        | "REJECTED"
        | string;
    employeeTaxProfile?: EmployeeTaxProfileDTO | null;
    onboardingReviewDecision?: string | null;
    onboardingReviewNote?: string | null;
    onboardingReviewCheckedSections?: Record<string, boolean> | null;
    onboardingReviewFieldFlags?: Record<string, string> | null;
    onboardingReviewContractSetupDraft?: OnboardingReviewContractSetupDraftDTO | null;
    hasIdDocumentImage?: boolean | null;
    hasIdDocumentBackImage?: boolean | null;
    assignedCaoId?: string | null;
    assignedCaoName?: string | null;
};

export type CompanyResponseDTO = {
    companyId: string;
    name: string;
    payoutFrequencyMinutes?: number | null;
    timesheetLoggingMode?: "AUTO_ON_SHIFT_END" | "ADMIN_FINALIZE" | string | null;
    travelClaimMode?: "AUTO_APPROVE" | "REQUIRES_APPROVAL" | string | null;
    payrollTaxTemplates?: PayrollTaxTemplateDTO[] | null;
};

export type PlatformCompanySummaryDTO = {
    companyId: string;
    name: string;
    payoutFrequencyMinutes?: number | null;
    timesheetLoggingMode?: "AUTO_ON_SHIFT_END" | "ADMIN_FINALIZE" | string | null;
    travelClaimMode?: "AUTO_APPROVE" | "REQUIRES_APPROVAL" | string | null;
    totalUsers: number;
    activeUsers: number;
    pendingOnboardingReview: number;
};

export type PlatformCompanyDetailDTO = PlatformCompanySummaryDTO;

export type PlatformCompanyOnboardingRequestDTO = {
    companyName: string;
    adminFirstNames: string;
    adminMiddleNamePrefix?: string | null;
    adminLastName: string;
    adminEmail: string;
};

export type PlatformCompanyOnboardingResponseDTO = {
    companyId: string;
    companyName: string;
    adminUserId: string;
    adminEmail: string;
    username?: string | null;
    temporaryPassword?: string | null;
};

export type UserUpdateRequestDTO = {
    email?: string | null;
    preferredName?: string | null;
    firstNames?: string | null;
    middleNamePrefix?: string | null;
    lastName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    mobileNumber?: string | null;
    street?: string | null;
    houseNumber?: string | null;
    houseNumberSuffix?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    iban?: string | null;
    employeeTaxProfile?: EmployeeTaxProfileDTO | null;
};

export type LeaveRequestCreateDTO = {
    type: LeaveType;
    startDate: string;
    endDate: string;
    hours: number;
    reason?: string;
};

export type LeaveRequestDTO = {
    requestId: string;
    userId: string;
    userName: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    hours: number;
    reason: string | null;
    status: LeaveStatus;
    createdAt: string;
    updatedAt: string;
};

export type AdminOnboardingRequestDTO = {
    email: string;
    firstNames: string;
    preferredName?: string | null;
    middleNamePrefix?: string | null;
    lastName: string;
    gender?: string | null;
    dateOfBirth: string;
    mobileNumber: string;
    workedForUsBefore: boolean;
    position: "BAR" | "RUNNER" | string;
    functionId?: string | null;
    functionName?: string | null;
    startDate: string;
    endDate: string;
    contractType: "FIXED" | "ON_CALL" | string;
    grossHourlyWage?: number | null;
    paymentFrequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | string;
    travelAllowance: boolean;
};

export type AdminOnboardingResponseDTO = {
    userId: string;
    contractId: string | null;
    username: string;
    temporaryPassword: string;
};

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
    note?: string | null;
    workedForUsBefore: boolean;
    contactConsent: boolean;
    informationAccurate: boolean;
};

export type JobApplicationResponseDTO = JobApplicationRequestDTO & {
    applicationId: string;
    profilePictureFileName?: string | null;
    profilePictureContentType?: string | null;
    hasProfilePicture?: boolean;
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
