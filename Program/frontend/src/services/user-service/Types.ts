export type LeaveType = "VACATION" | "SICK" | "UNPAID" | "PARENTAL" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";

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
    iban: string | null;
    companyId?: string | null;
    payslipFrequencyMinutes?: number | null;
    registeredDate?: string | null;
    status: "PENDING_SETUP" | "ACTIVE" | string;
    employeeTaxProfile?: EmployeeTaxProfileDTO | null;
};

export type CompanyResponseDTO = {
    companyId: string;
    name: string;
    payoutFrequencyMinutes?: number | null;
    timesheetLoggingMode?: "AUTO_ON_SHIFT_END" | "ADMIN_FINALIZE" | string | null;
    travelClaimMode?: "AUTO_APPROVE" | "REQUIRES_APPROVAL" | string | null;
    payrollTaxTemplates?: PayrollTaxTemplateDTO[] | null;
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
    startDate: string;
    endDate: string;
    contractType: "FIXED" | "ON_CALL" | string;
    grossHourlyWage: number;
    travelAllowance: boolean;
};

export type AdminOnboardingResponseDTO = {
    userId: string;
    contractId: string | null;
    username: string;
    temporaryPassword: string;
};
