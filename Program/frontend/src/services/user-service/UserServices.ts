import axios from "axios";
import ApproveLeaveRequest from "./ApproveLeaveRequest";
import { GetAuditLog } from "./AuditLogs";
import CompleteSetup, { UploadIdDocumentImages, type UserSetupRequest } from "./CompleteSetup";
import CreateLeaveRequest from "./CreateLeaveRequest";
import GetLeaveRequests from "./GetLeaveRequests";
import GetLeaveRequestsByStatus from "./GetLeaveRequestsByStatus";
import GetListUserLeaveRequests from "./GetListUserLeaveRequests";
import GetMe from "./GetMe";
import GetUsers from "./GetUsers";
import GetUsersPage from "./GetUsersPage";
import SearchUsers from "./SearchUsers";
import GetUserById from "./GetUserById";
import RejectLeaveRequest from "./RejectLeaveRequest";
import AdminOnboardEmployee from "./AdminOnboardEmployee";
import {
    AcceptApplication,
    DenyApplication,
    GetApplication,
    GetApplicationCv,
    GetApplicationProfilePicture,
    GetApplications,
    ResendApplicationDecisionEmail,
    SubmitApplication,
} from "./Applications";
import {
    GetAdminMessageConversation,
    GetAdminMessageConversations,
    GetMyMessageConversation,
    GetMyMessageUnreadCount,
    SendAdminMessage,
    SendMyMessage,
    type MessageConversationDTO,
    type MessageEntryDTO,
    type MessageSendRequestDTO,
    type MessageRealtimeEventDTO,
} from "./Messages";
import GetMyProfilePicture from "./GetMyProfilePicture";
import UpdateMyProfilePicture from "./UpdateMyProfilePicture";
import DeleteMyProfilePicture from "./DeleteMyProfilePicture";
import GetMyCompany from "./GetMyCompany";
import {
    GetPlatformCompanies,
    GetPlatformCompany,
    OnboardPlatformCompany,
} from "./PlatformAdmin";
import UpdateMyCompany, { type UpdateCompanyRequestDTO } from "./UpdateMyCompany";
import GetMyCompanyLogo from "./GetMyCompanyLogo";
import UpdateMyCompanyLogo from "./UpdateMyCompanyLogo";
import DeleteMyCompanyLogo from "./DeleteMyCompanyLogo";
import GetMyPayslips, { type PayslipResponseDTO } from "./GetMyPayslips";
import GetMyPayslipsPage from "./GetMyPayslipsPage";
import GetAllPayslips from "./GetAllPayslips";
import GetAllPayslipsPage from "./GetAllPayslipsPage";
import GetPayslipsForReview from "./GetPayslipsForReview";
import UpdateMyPayslipFrequency, { type UpdatePayslipFrequencyRequestDTO } from "./UpdateMyPayslipFrequency";
import GetMyTimesheets, { type MyTimesheetRow } from "./GetMyTimesheets";
import GetMyTimesheetsPage from "./GetMyTimesheetsPage";
import GetAllTimesheets, { type TimesheetRow } from "./GetAllTimesheets";
import GetAllTimesheetsPage from "./GetAllTimesheetsPage";
import GetTimesheetById from "./GetTimesheetById";
import GetUserDisplayNames from "./GetUserDisplayNames";
import GetPayslipPdf from "./GetPayslipPdf";
import {
    GetMyJaaropgaaf,
    GetMyJaaropgaafPdf,
    GetJaaropgaaf,
    GetJaaropgaafPdf,
    GetVerzamelloonstaat,
    GetVerzamelloonstaatPdf,
    FinalizeJaaropgaven,
    type JaaropgaafDTO,
    type VerzamelloonstaatDTO,
} from "./Jaaropgaaf";
import CreateTimesheet, { type CreateTimesheetRequestDTO, type CreateTimesheetResponseDTO } from "./CreateTimesheet";
import GetContracts, {
    CreateContract,
    FinalizeContract,
    GetContractPdf,
    GetContractsForUser,
    GetCurrentContract,
    GetMinimumWage,
    PrepareEmployerSignature,
    GetCurrentContractForUser,
    GetFunctions,
    GetMyContracts,
    RejectContract,
    SendContract,
    SignContract,
    UpdateContract,
    type ContractResponseDTO,
    type CreateContractRequestDTO,
    type FunctionResponseDTO,
    type MinimumWageResponseDTO,
    type SignContractRequestDTO,
} from "./GetContracts";
import ReportPayslipError, { type ReportPayslipErrorRequestDTO } from "./ReportPayslipError";
import GetPayslipById from "./GetPayslipById";
import UpdatePayslip, { type UpdatePayslipRequestDTO } from "./UpdatePayslip";
import GetUserProfilePicture from "./GetUserProfilePicture";
import GetUserIdDocumentImage from "./GetUserIdDocumentImage";
import UpdateUser from "./UpdateUser";
import UpdateOnboardingReview, { type OnboardingReviewUpdateRequest } from "./UpdateOnboardingReview";
import GetPlanningOverview, {
    type PlanningOverviewQuery,
    type PlanningDayDTO,
    type PlanningProjectDTO,
    type PlanningResourceAllocationDTO,
    type PlanningShiftDTO,
} from "./GetPlanningOverview";
import {
    GetMyPlanning,
    GetMyPlanningAssignment,
    GetPendingTravelClaims,
    GetTravelClaimProof,
    RespondToMyPlanningAssignment,
    ReviewTravelClaim,
    SubmitTravelClaim,
    type EmployeePlanningAssignmentDTO,
    type TravelClaimSummaryDTO,
} from "./EmployeePlanning";
import GetPlanningAssignmentAdmin from "./GetPlanningAssignmentAdmin";
import {
    GetCurrentHorecaRules,
    PublishCurrentHorecaRules,
    UpdateHorecaJobPresets,
    UpdateHorecaRuleSection,
} from "./HorecaRules";
import CreatePlanningClient, {
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanySaveDTO,
} from "./CreatePlanningClient";
import GetPlanningClients, {
    type PlanningClientCompanyContactDTO,
    type PlanningClientCompanyDTO,
} from "./GetPlanningClients";
import GetPlanningLocations, {
    type PlanningLocationDTO,
} from "./GetPlanningLocations";
import GetPlanningClientsPage from "./GetPlanningClientsPage";
import {
    CreatePlanningLocation,
    DeletePlanningLocation,
    type PlanningLocationSaveDTO,
    UpdatePlanningLocation,
} from "./ManagePlanningLocations";
import UpdatePlanningClient from "./UpdatePlanningClient";
import DeletePlanningClient from "./DeletePlanningClient";
import type { PaginatedResponse } from "./Pagination";
import FinalizePlanningProject, {
    type FinalizePlanningRequestDTO,
    type FinalizePlanningResponseDTO,
} from "./FinalizePlanningProject";
import {
    CreatePlanningAssignment,
    CreatePlanningProject,
    CreatePlanningShift,
    DeletePlanningAssignment,
    DeletePlanningProject,
    DeletePlanningShift,
    type PlanningAssignmentMutationResponseDTO,
    type PlanningAssignmentSaveDTO,
    type PlanningProjectMutationResponseDTO,
    type PlanningProjectSaveDTO,
    type PlanningShiftMutationResponseDTO,
    type PlanningShiftSaveDTO,
    UpdatePlanningAssignment,
    UpdatePlanningProject,
    UpdatePlanningShift,
} from "./ManagePlanningCrud";
import {
    GetClientBillingRates,
    GetUserBillingRates,
    DeleteBillingRate,
    SaveClientDefaultBillingRate,
    SaveClientEmployeeBillingRate,
    SaveProjectBillingRate,
    SaveProjectEmployeeBillingRate,
    type BillingRateDTO,
    type BillingRateSaveDTO,
    type ClientBillingRatesDTO,
    type UserBillingRatesDTO,
} from "./BillingRates";
import type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
    AuditLogEntryDTO,
    AuditLogQuery,
    ApplicationDecisionRequestDTO,
    ApplicationStatus,
    JobApplicationRequestDTO,
    JobApplicationResponseDTO,
    LeaveRequestCreateDTO,
    LeaveRequestDTO,
    LeaveStatus,
    LeaveType,
    CompanyResponseDTO,
    EmployeeTaxProfileDTO,
    HorecaJobPresetConfigDTO,
    HorecaJobPresetUpdateDTO,
    HorecaRuleItemDTO,
    HorecaRulePublishRequestDTO,
    HorecaRuleSectionUpdateDTO,
    HorecaRuleVersionDTO,
    PayrollDeductionLineDTO,
    PayrollTaxTemplateDTO,
    PlatformCompanyDetailDTO,
    PlatformCompanyOnboardingRequestDTO,
    PlatformCompanyOnboardingResponseDTO,
    PlatformCompanySummaryDTO,
    UserUpdateRequestDTO,
    UserResponseDTO,
} from "./Types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";
const inFlightRequests = new Map<string, Promise<unknown>>();

export type PlanningEventDTO = PlanningProjectDTO;
export type PlanningEventSaveDTO = PlanningProjectSaveDTO;

async function dedupeRequest<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key);
    if (existing) {
        return existing as Promise<T>;
    }

    const promise = loader().finally(() => {
        if (inFlightRequests.get(key) === promise) {
            inFlightRequests.delete(key);
        }
    });
    inFlightRequests.set(key, promise as Promise<unknown>);
    return promise;
}

export type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
    AuditLogEntryDTO,
    AuditLogQuery,
    ApplicationDecisionRequestDTO,
    ApplicationStatus,
    JobApplicationRequestDTO,
    JobApplicationResponseDTO,
    LeaveRequestCreateDTO,
    LeaveRequestDTO,
    LeaveStatus,
    LeaveType,
    CompanyResponseDTO,
    EmployeeTaxProfileDTO,
    HorecaJobPresetConfigDTO,
    HorecaJobPresetUpdateDTO,
    HorecaRuleItemDTO,
    HorecaRulePublishRequestDTO,
    HorecaRuleSectionUpdateDTO,
    HorecaRuleVersionDTO,
    PayslipResponseDTO,
    PayrollDeductionLineDTO,
    PayrollTaxTemplateDTO,
    PlatformCompanyDetailDTO,
    PlatformCompanyOnboardingRequestDTO,
    PlatformCompanyOnboardingResponseDTO,
    PlatformCompanySummaryDTO,
    UpdatePayslipFrequencyRequestDTO,
    UserUpdateRequestDTO,
    UserResponseDTO,
    UserSetupRequest,
    TimesheetRow,
    CreateTimesheetRequestDTO,
    CreateTimesheetResponseDTO,
    ContractResponseDTO,
    CreateContractRequestDTO,
    FunctionResponseDTO,
    MinimumWageResponseDTO,
    SignContractRequestDTO,
    ReportPayslipErrorRequestDTO,
    UpdatePayslipRequestDTO,
    MessageConversationDTO,
    MessageEntryDTO,
    MessageSendRequestDTO,
    MessageRealtimeEventDTO,
    PlanningProjectDTO,
    PlanningDayDTO,
    PlanningShiftDTO,
    PlanningResourceAllocationDTO,
    PlanningClientCompanyDTO,
    PlanningClientCompanyContactDTO,
    PlanningLocationDTO,
    PlanningClientCompanySaveDTO,
    PlanningClientCompanyContactSaveDTO,
    PlanningLocationSaveDTO,
    FinalizePlanningRequestDTO,
    FinalizePlanningResponseDTO,
    PlanningProjectSaveDTO,
    PlanningShiftSaveDTO,
    PlanningAssignmentSaveDTO,
    PlanningProjectMutationResponseDTO,
    PlanningShiftMutationResponseDTO,
    PlanningAssignmentMutationResponseDTO,
    BillingRateDTO,
    BillingRateSaveDTO,
    ClientBillingRatesDTO,
    UserBillingRatesDTO,
    PaginatedResponse,
    EmployeePlanningAssignmentDTO,
    TravelClaimSummaryDTO,
};

export const UserServices = {
    submitApplication: async (
        payload: JobApplicationRequestDTO,
        profilePicture: File,
        cv?: File | null
    ): Promise<JobApplicationResponseDTO> => {
        return await SubmitApplication(API_BASE_URL, payload, profilePicture, cv);
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
    resendApplicationDecisionEmail: async (applicationId: string): Promise<JobApplicationResponseDTO> => {
        return await ResendApplicationDecisionEmail(API_BASE_URL, applicationId);
    },
    getApplicationCv: async (applicationId: string): Promise<Blob> => {
        return await GetApplicationCv(API_BASE_URL, applicationId);
    },
    getApplicationProfilePicture: async (applicationId: string): Promise<Blob> => {
        return await GetApplicationProfilePicture(API_BASE_URL, applicationId);
    },
    adminOnboardEmployee: async (
        payload: AdminOnboardingRequestDTO
    ): Promise<AdminOnboardingResponseDTO> => {
        return await AdminOnboardEmployee(API_BASE_URL, payload);
    },
    getUsers: async (): Promise<UserResponseDTO[]> => {
        return await dedupeRequest("getUsers", () => GetUsers(API_BASE_URL));
    },
    searchUsers: async (query: string, limit = 20): Promise<UserResponseDTO[]> => {
        return await SearchUsers(API_BASE_URL, query, limit);
    },
    getUsersPage: async (page: number, size = 50, sortKey?: string, sortDirection?: "asc" | "desc"): Promise<PaginatedResponse<UserResponseDTO>> => {
        return await GetUsersPage(API_BASE_URL, { page, size, sortKey, sortDirection });
    },
    getUserById: async (userId: string): Promise<UserResponseDTO> => {
        return await GetUserById(API_BASE_URL, userId);
    },
    deleteUser: async (userId: string): Promise<void> => {
        try {
            await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
                withCredentials: true,
            });
        } catch (err) {
            if (axios.isAxiosError(err)) {
                throw new Error(err.response?.data?.message || "Failed to delete user");
            }
            throw err;
        }
    },
    updateUser: async (userId: string, payload: UserUpdateRequestDTO): Promise<UserResponseDTO> => {
        return await UpdateUser(API_BASE_URL, userId, payload);
    },
    updateOnboardingReview: async (userId: string, payload: OnboardingReviewUpdateRequest): Promise<UserResponseDTO> => {
        return await UpdateOnboardingReview(API_BASE_URL, userId, payload);
    },
    getMe: async (): Promise<UserResponseDTO> => {
        return await dedupeRequest("getMe", () => GetMe(API_BASE_URL));
    },
    getMyMessageConversation: async (): Promise<MessageConversationDTO> => {
        return await dedupeRequest("getMyMessageConversation", () => GetMyMessageConversation(API_BASE_URL));
    },
    getMyMessageUnreadCount: async (): Promise<number> => {
        const unread = await dedupeRequest("getMyMessageUnreadCount", () => GetMyMessageUnreadCount(API_BASE_URL));
        return unread.unreadByUserCount ?? 0;
    },
    sendMyMessage: async (payload: MessageSendRequestDTO): Promise<MessageConversationDTO> => {
        return await SendMyMessage(API_BASE_URL, payload);
    },
    getAdminMessageConversations: async (): Promise<MessageConversationDTO[]> => {
        return await GetAdminMessageConversations(API_BASE_URL);
    },
    getAdminMessageConversation: async (conversationId: string): Promise<MessageConversationDTO> => {
        return await GetAdminMessageConversation(API_BASE_URL, conversationId);
    },
    sendAdminMessage: async (
        conversationId: string,
        payload: MessageSendRequestDTO
    ): Promise<MessageConversationDTO> => {
        return await SendAdminMessage(API_BASE_URL, conversationId, payload);
    },
    getMyCompany: async (): Promise<CompanyResponseDTO> => {
        return await dedupeRequest("getMyCompany", () => GetMyCompany(API_BASE_URL));
    },
    getPlatformCompanies: async (): Promise<PlatformCompanySummaryDTO[]> => {
        return await GetPlatformCompanies(API_BASE_URL);
    },
    getPlatformCompany: async (companyId: string): Promise<PlatformCompanyDetailDTO> => {
        return await GetPlatformCompany(API_BASE_URL, companyId);
    },
    onboardPlatformCompany: async (
        payload: PlatformCompanyOnboardingRequestDTO
    ): Promise<PlatformCompanyOnboardingResponseDTO> => {
        return await OnboardPlatformCompany(API_BASE_URL, payload);
    },
    updateMyCompany: async (payload: UpdateCompanyRequestDTO): Promise<CompanyResponseDTO> => {
        return await UpdateMyCompany(API_BASE_URL, payload);
    },
    getMyCompanyLogo: async (): Promise<Blob | null> => {
        return await dedupeRequest("getMyCompanyLogo", () => GetMyCompanyLogo(API_BASE_URL));
    },
    updateMyCompanyLogo: async (file: File): Promise<void> => {
        return await UpdateMyCompanyLogo(API_BASE_URL, file);
    },
    deleteMyCompanyLogo: async (): Promise<void> => {
        return await DeleteMyCompanyLogo(API_BASE_URL);
    },
    getMyTimesheets: async (): Promise<
        MyTimesheetRow[]
    > => {
        return await dedupeRequest("getMyTimesheets", () => GetMyTimesheets(API_BASE_URL));
    },
    getMyTimesheetsPage: async (page: number, size = 50): Promise<PaginatedResponse<MyTimesheetRow>> => {
        return await GetMyTimesheetsPage(API_BASE_URL, { page, size });
    },
    getTimesheets: async (): Promise<TimesheetRow[]> => {
        return await dedupeRequest("getTimesheets", () => GetAllTimesheets(API_BASE_URL));
    },
    getTimesheetsPage: async (page: number, size = 50): Promise<PaginatedResponse<TimesheetRow>> => {
        return await GetAllTimesheetsPage(API_BASE_URL, { page, size });
    },
    getTimesheetById: async (timesheetId: string): Promise<TimesheetRow> => {
        return await GetTimesheetById(API_BASE_URL, timesheetId);
    },
    getUserDisplayNames: async (userIds: string[]): Promise<Record<string, string>> => {
        return await GetUserDisplayNames(API_BASE_URL, userIds);
    },
    getContracts: async (): Promise<ContractResponseDTO[]> => {
        return await dedupeRequest("getContracts", () => GetContracts(API_BASE_URL));
    },
    getMyContracts: async (): Promise<ContractResponseDTO[]> => {
        return await dedupeRequest("getMyContracts", () => GetMyContracts(API_BASE_URL));
    },
    getCurrentContract: async (): Promise<ContractResponseDTO | null> => {
        return await dedupeRequest("getCurrentContract", () => GetCurrentContract(API_BASE_URL));
    },
    getCurrentContractForUser: async (userId: string): Promise<ContractResponseDTO | null> => {
        return await GetCurrentContractForUser(API_BASE_URL, userId);
    },
    getContractsForUser: async (userId: string): Promise<ContractResponseDTO[]> => {
        return await GetContractsForUser(API_BASE_URL, userId);
    },
    getFunctions: async (): Promise<FunctionResponseDTO[]> => {
        return await GetFunctions(API_BASE_URL);
    },
    getMinimumWage: async (startDate: string, dateOfBirth: string): Promise<MinimumWageResponseDTO> => {
        return await GetMinimumWage(API_BASE_URL, startDate, dateOfBirth);
    },
    createContract: async (payload: CreateContractRequestDTO): Promise<ContractResponseDTO> => {
        return await CreateContract(API_BASE_URL, payload);
    },
    updateContract: async (contractId: string, payload: CreateContractRequestDTO): Promise<ContractResponseDTO> => {
        return await UpdateContract(API_BASE_URL, contractId, payload);
    },
    getContractPdf: async (contractId: string): Promise<Blob> => {
        return await GetContractPdf(API_BASE_URL, contractId);
    },
    signContract: async (contractId: string, payload: SignContractRequestDTO): Promise<ContractResponseDTO> => {
        return await SignContract(API_BASE_URL, contractId, payload);
    },
    sendContract: async (contractId: string): Promise<ContractResponseDTO> => {
        return await SendContract(API_BASE_URL, contractId);
    },
    finalizeContract: async (contractId: string, payload: SignContractRequestDTO): Promise<ContractResponseDTO> => {
        return await FinalizeContract(API_BASE_URL, contractId, payload);
    },
    prepareEmployerSignature: async (contractId: string, payload: SignContractRequestDTO): Promise<ContractResponseDTO> => {
        return await PrepareEmployerSignature(API_BASE_URL, contractId, payload);
    },
    rejectContract: async (contractId: string, comment: string): Promise<ContractResponseDTO> => {
        return await RejectContract(API_BASE_URL, contractId, comment);
    },
    getPlanningOverview: async (
        companyId?: string,
        projectId?: string,
        range?: Omit<PlanningOverviewQuery, "companyId" | "projectId">
    ): Promise<PlanningProjectDTO[]> => {
        return await GetPlanningOverview(API_BASE_URL, { companyId, projectId, ...range });
    },
    getMyPlanning: async (scope = "all"): Promise<EmployeePlanningAssignmentDTO[]> => {
        return await GetMyPlanning(API_BASE_URL, scope);
    },
    getMyPlanningAssignment: async (scheduleEntryId: string): Promise<EmployeePlanningAssignmentDTO> => {
        return await GetMyPlanningAssignment(API_BASE_URL, scheduleEntryId);
    },
    getPlanningAssignmentAdmin: async (scheduleEntryId: string): Promise<EmployeePlanningAssignmentDTO> => {
        return await GetPlanningAssignmentAdmin(API_BASE_URL, scheduleEntryId);
    },
    respondToMyPlanningAssignment: async (
        scheduleEntryId: string,
        status: "CONFIRMED" | "CANCELLED"
    ): Promise<EmployeePlanningAssignmentDTO> => {
        return await RespondToMyPlanningAssignment(API_BASE_URL, scheduleEntryId, status);
    },
    submitTravelClaim: async (
        scheduleEntryId: string,
        payload: { kilometers: number; file?: File | null }
    ): Promise<EmployeePlanningAssignmentDTO> => {
        return await SubmitTravelClaim(API_BASE_URL, scheduleEntryId, payload);
    },
    getTravelClaimProof: async (scheduleEntryId: string, admin = false): Promise<Blob> => {
        return await GetTravelClaimProof(API_BASE_URL, scheduleEntryId, admin);
    },
    getPendingTravelClaims: async (): Promise<EmployeePlanningAssignmentDTO[]> => {
        return await GetPendingTravelClaims(API_BASE_URL);
    },
    reviewTravelClaim: async (
        scheduleEntryId: string,
        payload: { status: "APPROVED" | "REJECTED"; rejectionNote?: string }
    ): Promise<EmployeePlanningAssignmentDTO> => {
        return await ReviewTravelClaim(API_BASE_URL, scheduleEntryId, payload);
    },
    getPlanningClients: async (): Promise<PlanningClientCompanyDTO[]> => {
        return await GetPlanningClients(API_BASE_URL);
    },
    getPlanningLocations: async (clientCompanyId?: string | null): Promise<PlanningLocationDTO[]> => {
        return await GetPlanningLocations(API_BASE_URL, clientCompanyId);
    },
    getPlanningClientsPage: async (page: number, size = 50): Promise<PaginatedResponse<PlanningClientCompanyDTO>> => {
        return await GetPlanningClientsPage(API_BASE_URL, { page, size });
    },
    createPlanningClient: async (payload: PlanningClientCompanySaveDTO): Promise<PlanningClientCompanyDTO> => {
        return await CreatePlanningClient(API_BASE_URL, payload);
    },
    updatePlanningClient: async (
        clientCompanyId: string,
        payload: PlanningClientCompanySaveDTO
    ): Promise<PlanningClientCompanyDTO> => {
        return await UpdatePlanningClient(API_BASE_URL, clientCompanyId, payload);
    },
    deletePlanningClient: async (clientCompanyId: string): Promise<void> => {
        return await DeletePlanningClient(API_BASE_URL, clientCompanyId);
    },
    createPlanningLocation: async (payload: PlanningLocationSaveDTO): Promise<PlanningLocationDTO> => {
        return await CreatePlanningLocation(API_BASE_URL, payload);
    },
    updatePlanningLocation: async (
        locationId: string,
        payload: PlanningLocationSaveDTO
    ): Promise<PlanningLocationDTO> => {
        return await UpdatePlanningLocation(API_BASE_URL, locationId, payload);
    },
    deletePlanningLocation: async (locationId: string): Promise<void> => {
        return await DeletePlanningLocation(API_BASE_URL, locationId);
    },
    createPlanningProject: async (payload: PlanningProjectSaveDTO): Promise<PlanningProjectMutationResponseDTO> => {
        return await CreatePlanningProject(API_BASE_URL, payload);
    },
    updatePlanningProject: async (projectId: string, payload: PlanningProjectSaveDTO): Promise<PlanningProjectMutationResponseDTO> => {
        return await UpdatePlanningProject(API_BASE_URL, projectId, payload);
    },
    deletePlanningProject: async (projectId: string): Promise<void> => {
        return await DeletePlanningProject(API_BASE_URL, projectId);
    },
    createPlanningShift: async (projectId: string, payload: PlanningShiftSaveDTO): Promise<PlanningShiftMutationResponseDTO> => {
        return await CreatePlanningShift(API_BASE_URL, projectId, payload);
    },
    updatePlanningShift: async (shiftId: string, payload: PlanningShiftSaveDTO): Promise<PlanningShiftMutationResponseDTO> => {
        return await UpdatePlanningShift(API_BASE_URL, shiftId, payload);
    },
    deletePlanningShift: async (shiftId: string): Promise<void> => {
        return await DeletePlanningShift(API_BASE_URL, shiftId);
    },
    createPlanningAssignment: async (
        shiftId: string,
        payload: PlanningAssignmentSaveDTO
    ): Promise<PlanningAssignmentMutationResponseDTO> => {
        return await CreatePlanningAssignment(API_BASE_URL, shiftId, payload);
    },
    updatePlanningAssignment: async (
        scheduleEntryId: string,
        payload: PlanningAssignmentSaveDTO
    ): Promise<PlanningAssignmentMutationResponseDTO> => {
        return await UpdatePlanningAssignment(API_BASE_URL, scheduleEntryId, payload);
    },
    deletePlanningAssignment: async (scheduleEntryId: string): Promise<void> => {
        return await DeletePlanningAssignment(API_BASE_URL, scheduleEntryId);
    },
    finalizePlanningProject: async (payload: FinalizePlanningRequestDTO): Promise<FinalizePlanningResponseDTO> => {
        return await FinalizePlanningProject(API_BASE_URL, payload);
    },
    getClientBillingRates: async (clientCompanyId: string): Promise<ClientBillingRatesDTO> => {
        return await GetClientBillingRates(API_BASE_URL, clientCompanyId);
    },
    getUserBillingRates: async (userId: string): Promise<UserBillingRatesDTO> => {
        return await GetUserBillingRates(API_BASE_URL, userId);
    },
    saveClientDefaultBillingRate: async (
        clientCompanyId: string,
        payload: BillingRateSaveDTO
    ): Promise<BillingRateDTO> => {
        return await SaveClientDefaultBillingRate(API_BASE_URL, clientCompanyId, payload);
    },
    saveProjectBillingRate: async (
        clientCompanyId: string,
        payload: BillingRateSaveDTO
    ): Promise<BillingRateDTO> => {
        return await SaveProjectBillingRate(API_BASE_URL, clientCompanyId, payload);
    },
    saveClientEmployeeBillingRate: async (
        clientCompanyId: string,
        payload: BillingRateSaveDTO
    ): Promise<BillingRateDTO> => {
        return await SaveClientEmployeeBillingRate(API_BASE_URL, clientCompanyId, payload);
    },
    saveProjectEmployeeBillingRate: async (
        clientCompanyId: string,
        payload: BillingRateSaveDTO
    ): Promise<BillingRateDTO> => {
        return await SaveProjectEmployeeBillingRate(API_BASE_URL, clientCompanyId, payload);
    },
    deleteBillingRate: async (
        clientCompanyId: string,
        scope: string,
        rateId: string
    ): Promise<void> => {
        return await DeleteBillingRate(API_BASE_URL, clientCompanyId, scope, rateId);
    },
    createTimesheet: async (payload: CreateTimesheetRequestDTO): Promise<CreateTimesheetResponseDTO> => {
        return await CreateTimesheet(API_BASE_URL, payload);
    },
    getMyPayslips: async (): Promise<PayslipResponseDTO[]> => {
        return await GetMyPayslips(API_BASE_URL);
    },
    getMyPayslipsPage: async (page: number, size = 50): Promise<PaginatedResponse<PayslipResponseDTO>> => {
        return await GetMyPayslipsPage(API_BASE_URL, { page, size });
    },
    getAllPayslips: async (): Promise<PayslipResponseDTO[]> => {
        return await GetAllPayslips(API_BASE_URL);
    },
    getAllPayslipsPage: async (page: number, size = 50): Promise<PaginatedResponse<PayslipResponseDTO>> => {
        return await GetAllPayslipsPage(API_BASE_URL, { page, size });
    },
    getPayslipsForReview: async (): Promise<PayslipResponseDTO[]> => {
        return await GetPayslipsForReview(API_BASE_URL);
    },
    getPayslipById: async (payslipId: string): Promise<PayslipResponseDTO> => {
        return await GetPayslipById(API_BASE_URL, payslipId);
    },
    getPayslipPdf: async (payslipId: string): Promise<Blob> => {
        return await GetPayslipPdf(API_BASE_URL, payslipId);
    },
    getMyJaaropgaaf: async (year: number): Promise<JaaropgaafDTO> => {
        return await GetMyJaaropgaaf(API_BASE_URL, year);
    },
    getMyJaaropgaafPdf: async (year: number): Promise<Blob> => {
        return await GetMyJaaropgaafPdf(API_BASE_URL, year);
    },
    getJaaropgaaf: async (employeeId: string, year: number): Promise<JaaropgaafDTO> => {
        return await GetJaaropgaaf(API_BASE_URL, employeeId, year);
    },
    getJaaropgaafPdf: async (employeeId: string, year: number): Promise<Blob> => {
        return await GetJaaropgaafPdf(API_BASE_URL, employeeId, year);
    },
    getVerzamelloonstaat: async (year: number): Promise<VerzamelloonstaatDTO> => {
        return await GetVerzamelloonstaat(API_BASE_URL, year);
    },
    getVerzamelloonstaatPdf: async (year: number): Promise<Blob> => {
        return await GetVerzamelloonstaatPdf(API_BASE_URL, year);
    },
    finalizeJaaropgaven: async (year: number): Promise<{ year: number; finalized: number }> => {
        return await FinalizeJaaropgaven(API_BASE_URL, year);
    },
    updatePayslip: async (
        payslipId: string,
        payload: UpdatePayslipRequestDTO
    ): Promise<PayslipResponseDTO> => {
        return await UpdatePayslip(API_BASE_URL, payslipId, payload);
    },
    reportPayslipError: async (payslipId: string, payload: ReportPayslipErrorRequestDTO): Promise<PayslipResponseDTO> => {
        return await ReportPayslipError(API_BASE_URL, payslipId, payload);
    },
    updateMyPayslipFrequency: async (payload: UpdatePayslipFrequencyRequestDTO): Promise<UserResponseDTO> => {
        return await UpdateMyPayslipFrequency(API_BASE_URL, payload);
    },
    getMyProfilePicture: async (): Promise<Blob | null> => {
        return await GetMyProfilePicture(API_BASE_URL);
    },
    getUserProfilePicture: async (userId: string): Promise<Blob | null> => {
        return await GetUserProfilePicture(API_BASE_URL, userId);
    },
    getUserIdDocumentImage: async (userId: string): Promise<Blob | null> => {
        return await GetUserIdDocumentImage(API_BASE_URL, userId);
    },
    getUserIdDocumentBackImage: async (userId: string): Promise<Blob | null> => {
        return await GetUserIdDocumentImage(API_BASE_URL, userId, "back");
    },
    updateMyProfilePicture: async (file: File): Promise<void> => {
        return await UpdateMyProfilePicture(API_BASE_URL, file);
    },
    deleteMyProfilePicture: async (): Promise<void> => {
        return await DeleteMyProfilePicture(API_BASE_URL);
    },
    completeSetup: async (payload: UserSetupRequest): Promise<void> => {
        return await CompleteSetup(API_BASE_URL, payload);
    },
    uploadIdDocumentImages: async (front: File, back: File): Promise<void> => {
        return await UploadIdDocumentImages(API_BASE_URL, front, back);
    },
    uploadIdDocumentImage: async (file: File): Promise<void> => {
        return await UploadIdDocumentImages(API_BASE_URL, file, file);
    },
    getCurrentHorecaRules: async (): Promise<HorecaRuleVersionDTO> => {
        return await GetCurrentHorecaRules(API_BASE_URL);
    },
    updateHorecaRuleSection: async (
        sectionKey: string,
        payload: HorecaRuleSectionUpdateDTO
    ): Promise<HorecaRuleVersionDTO> => {
        return await UpdateHorecaRuleSection(API_BASE_URL, sectionKey, payload);
    },
    updateHorecaJobPresets: async (payload: HorecaJobPresetUpdateDTO): Promise<HorecaRuleVersionDTO> => {
        return await UpdateHorecaJobPresets(API_BASE_URL, payload);
    },
    publishCurrentHorecaRules: async (payload: HorecaRulePublishRequestDTO): Promise<HorecaRuleVersionDTO> => {
        return await PublishCurrentHorecaRules(API_BASE_URL, payload);
    },
    getAuditLog: async (query: AuditLogQuery = {}): Promise<PaginatedResponse<AuditLogEntryDTO>> => {
        return await GetAuditLog(API_BASE_URL, query);
    },
    leaveRequests: {
        list: async (status?: LeaveStatus): Promise<LeaveRequestDTO[]> => {
            if (status) return await GetLeaveRequestsByStatus(API_BASE_URL, status);
            return await GetLeaveRequests(API_BASE_URL);
        },
        listMine: async (userId: string): Promise<LeaveRequestDTO[]> => {
            return await GetListUserLeaveRequests(API_BASE_URL, userId);
        },
        create: async (
            userId: string,
            payload: LeaveRequestCreateDTO
        ): Promise<LeaveRequestDTO> => {
            return await CreateLeaveRequest(API_BASE_URL, userId, payload);
        },
        approve: async (requestId: string): Promise<void> => {
            return await ApproveLeaveRequest(API_BASE_URL, requestId);
        },
        reject: async (requestId: string, note?: string): Promise<void> => {
            return await RejectLeaveRequest(API_BASE_URL, requestId, note);
        },
    },
    assignUserCao: async (
        userId: string,
        caoId: string | null,
        overrides?: Record<string, number> | null
    ): Promise<UserResponseDTO> => {
        const res = await axios.put<UserResponseDTO>(
            `${API_BASE_URL}/api/users/${userId}/cao`,
            { caoId, overrides: overrides ?? null },
            { withCredentials: true }
        );
        return res.data;
    },
};
