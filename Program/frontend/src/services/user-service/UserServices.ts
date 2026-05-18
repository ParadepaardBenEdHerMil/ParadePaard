import ApproveLeaveRequest from "./ApproveLeaveRequest";
import CompleteSetup, { UploadIdDocumentImage, type UserSetupRequest } from "./CompleteSetup";
import CreateLeaveRequest from "./CreateLeaveRequest";
import GetLeaveRequests from "./GetLeaveRequests";
import GetLeaveRequestsByStatus from "./GetLeaveRequestsByStatus";
import GetListUserLeaveRequests from "./GetListUserLeaveRequests";
import GetMe from "./GetMe";
import GetUsers from "./GetUsers";
import GetUsersPage from "./GetUsersPage";
import GetUserById from "./GetUserById";
import RejectLeaveRequest from "./RejectLeaveRequest";
import AdminOnboardEmployee from "./AdminOnboardEmployee";
import {
    AcceptApplication,
    DenyApplication,
    GetApplication,
    GetApplicationCv,
    GetApplications,
    ResendApplicationDecisionEmail,
    SubmitApplication,
} from "./Applications";
import {
    GetAdminMessageConversation,
    GetAdminMessageConversations,
    GetMyMessageConversation,
    SendAdminMessage,
    SendMyMessage,
    type MessageConversationDTO,
    type MessageEntryDTO,
    type MessageSendRequestDTO,
} from "./Messages";
import GetMyProfilePicture from "./GetMyProfilePicture";
import UpdateMyProfilePicture from "./UpdateMyProfilePicture";
import DeleteMyProfilePicture from "./DeleteMyProfilePicture";
import GetMyCompany from "./GetMyCompany";
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
import CreateTimesheet, { type CreateTimesheetRequestDTO, type CreateTimesheetResponseDTO } from "./CreateTimesheet";
import GetContracts, {
    CreateContract,
    FinalizeContract,
    GetContractPdf,
    GetContractsForUser,
    GetCurrentContract,
    GetCurrentContractForUser,
    GetFunctions,
    GetMyContracts,
    RejectContract,
    SendContract,
    SignContract,
    type ContractResponseDTO,
    type CreateContractRequestDTO,
    type FunctionResponseDTO,
    type SignContractRequestDTO,
} from "./GetContracts";
import ReportPayslipError, { type ReportPayslipErrorRequestDTO } from "./ReportPayslipError";
import GetPayslipById from "./GetPayslipById";
import UpdatePayslip, { type UpdatePayslipRequestDTO } from "./UpdatePayslip";
import GetUserProfilePicture from "./GetUserProfilePicture";
import GetUserIdDocumentImage from "./GetUserIdDocumentImage";
import UpdateUser from "./UpdateUser";
import GetPlanningOverview, {
    type PlanningOverviewQuery,
    type PlanningDayDTO,
    type PlanningEventDTO,
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
import CreatePlanningClient, {
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanySaveDTO,
} from "./CreatePlanningClient";
import GetPlanningClients, {
    type PlanningClientCompanyContactDTO,
    type PlanningClientCompanyDTO,
} from "./GetPlanningClients";
import GetPlanningClientsPage from "./GetPlanningClientsPage";
import UpdatePlanningClient from "./UpdatePlanningClient";
import type { PaginatedResponse } from "./Pagination";
import FinalizePlanningEvent, {
    type FinalizePlanningRequestDTO,
    type FinalizePlanningResponseDTO,
} from "./FinalizePlanningEvent";
import {
    CreatePlanningAssignment,
    CreatePlanningEvent,
    CreatePlanningShift,
    DeletePlanningAssignment,
    DeletePlanningEvent,
    DeletePlanningShift,
    type PlanningAssignmentMutationResponseDTO,
    type PlanningAssignmentSaveDTO,
    type PlanningEventMutationResponseDTO,
    type PlanningEventSaveDTO,
    type PlanningShiftMutationResponseDTO,
    type PlanningShiftSaveDTO,
    UpdatePlanningAssignment,
    UpdatePlanningEvent,
    UpdatePlanningShift,
} from "./ManagePlanningCrud";
import type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
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
    PayrollDeductionLineDTO,
    PayrollTaxTemplateDTO,
    UserUpdateRequestDTO,
    UserResponseDTO,
} from "./Types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";

export type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
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
    PayslipResponseDTO,
    PayrollDeductionLineDTO,
    PayrollTaxTemplateDTO,
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
    SignContractRequestDTO,
    ReportPayslipErrorRequestDTO,
    UpdatePayslipRequestDTO,
    MessageConversationDTO,
    MessageEntryDTO,
    MessageSendRequestDTO,
    PlanningEventDTO,
    PlanningDayDTO,
    PlanningShiftDTO,
    PlanningResourceAllocationDTO,
    PlanningClientCompanyDTO,
    PlanningClientCompanyContactDTO,
    PlanningClientCompanySaveDTO,
    PlanningClientCompanyContactSaveDTO,
    FinalizePlanningRequestDTO,
    FinalizePlanningResponseDTO,
    PlanningEventSaveDTO,
    PlanningShiftSaveDTO,
    PlanningAssignmentSaveDTO,
    PlanningEventMutationResponseDTO,
    PlanningShiftMutationResponseDTO,
    PlanningAssignmentMutationResponseDTO,
    PaginatedResponse,
    EmployeePlanningAssignmentDTO,
    TravelClaimSummaryDTO,
};

export const UserServices = {
    submitApplication: async (
        payload: JobApplicationRequestDTO,
        cv?: File | null
    ): Promise<JobApplicationResponseDTO> => {
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
    resendApplicationDecisionEmail: async (applicationId: string): Promise<JobApplicationResponseDTO> => {
        return await ResendApplicationDecisionEmail(API_BASE_URL, applicationId);
    },
    getApplicationCv: async (applicationId: string): Promise<Blob> => {
        return await GetApplicationCv(API_BASE_URL, applicationId);
    },
    adminOnboardEmployee: async (
        payload: AdminOnboardingRequestDTO
    ): Promise<AdminOnboardingResponseDTO> => {
        return await AdminOnboardEmployee(API_BASE_URL, payload);
    },
    getUsers: async (): Promise<UserResponseDTO[]> => {
        return await GetUsers(API_BASE_URL);
    },
    getUsersPage: async (page: number, size = 50, sortKey?: string, sortDirection?: "asc" | "desc"): Promise<PaginatedResponse<UserResponseDTO>> => {
        return await GetUsersPage(API_BASE_URL, { page, size, sortKey, sortDirection });
    },
    getUserById: async (userId: string): Promise<UserResponseDTO> => {
        return await GetUserById(API_BASE_URL, userId);
    },
    updateUser: async (userId: string, payload: UserUpdateRequestDTO): Promise<UserResponseDTO> => {
        return await UpdateUser(API_BASE_URL, userId, payload);
    },
    getMe: async (): Promise<UserResponseDTO> => {
        return await GetMe(API_BASE_URL);
    },
    getMyMessageConversation: async (): Promise<MessageConversationDTO> => {
        return await GetMyMessageConversation(API_BASE_URL);
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
        return await GetMyCompany(API_BASE_URL);
    },
    updateMyCompany: async (payload: UpdateCompanyRequestDTO): Promise<CompanyResponseDTO> => {
        return await UpdateMyCompany(API_BASE_URL, payload);
    },
    getMyCompanyLogo: async (): Promise<Blob | null> => {
        return await GetMyCompanyLogo(API_BASE_URL);
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
        return await GetMyTimesheets(API_BASE_URL);
    },
    getMyTimesheetsPage: async (page: number, size = 50): Promise<PaginatedResponse<MyTimesheetRow>> => {
        return await GetMyTimesheetsPage(API_BASE_URL, { page, size });
    },
    getTimesheets: async (): Promise<TimesheetRow[]> => {
        return await GetAllTimesheets(API_BASE_URL);
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
        return await GetContracts(API_BASE_URL);
    },
    getMyContracts: async (): Promise<ContractResponseDTO[]> => {
        return await GetMyContracts(API_BASE_URL);
    },
    getCurrentContract: async (): Promise<ContractResponseDTO | null> => {
        return await GetCurrentContract(API_BASE_URL);
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
    createContract: async (payload: CreateContractRequestDTO): Promise<ContractResponseDTO> => {
        return await CreateContract(API_BASE_URL, payload);
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
    rejectContract: async (contractId: string, comment: string): Promise<ContractResponseDTO> => {
        return await RejectContract(API_BASE_URL, contractId, comment);
    },
    getPlanningOverview: async (
        companyId?: string,
        eventId?: string,
        range?: Omit<PlanningOverviewQuery, "companyId" | "eventId">
    ): Promise<PlanningEventDTO[]> => {
        return await GetPlanningOverview(API_BASE_URL, { companyId, eventId, ...range });
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
    createPlanningEvent: async (payload: PlanningEventSaveDTO): Promise<PlanningEventMutationResponseDTO> => {
        return await CreatePlanningEvent(API_BASE_URL, payload);
    },
    updatePlanningEvent: async (eventId: string, payload: PlanningEventSaveDTO): Promise<PlanningEventMutationResponseDTO> => {
        return await UpdatePlanningEvent(API_BASE_URL, eventId, payload);
    },
    deletePlanningEvent: async (eventId: string): Promise<void> => {
        return await DeletePlanningEvent(API_BASE_URL, eventId);
    },
    createPlanningShift: async (eventId: string, payload: PlanningShiftSaveDTO): Promise<PlanningShiftMutationResponseDTO> => {
        return await CreatePlanningShift(API_BASE_URL, eventId, payload);
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
    finalizePlanningEvent: async (payload: FinalizePlanningRequestDTO): Promise<FinalizePlanningResponseDTO> => {
        return await FinalizePlanningEvent(API_BASE_URL, payload);
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
    updateMyProfilePicture: async (file: File): Promise<void> => {
        return await UpdateMyProfilePicture(API_BASE_URL, file);
    },
    deleteMyProfilePicture: async (): Promise<void> => {
        return await DeleteMyProfilePicture(API_BASE_URL);
    },
    completeSetup: async (payload: UserSetupRequest): Promise<void> => {
        return await CompleteSetup(API_BASE_URL, payload);
    },
    uploadIdDocumentImage: async (file: File): Promise<void> => {
        return await UploadIdDocumentImage(API_BASE_URL, file);
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
};
