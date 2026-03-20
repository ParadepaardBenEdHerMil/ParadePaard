import ApproveLeaveRequest from "./ApproveLeaveRequest";
import CompleteSetup, { type UserSetupRequest } from "./CompleteSetup";
import CreateLeaveRequest from "./CreateLeaveRequest";
import GetLeaveRequests from "./GetLeaveRequests";
import GetLeaveRequestsByStatus from "./GetLeaveRequestsByStatus";
import GetListUserLeaveRequests from "./GetListUserLeaveRequests";
import GetMe from "./GetMe";
import GetUsers from "./GetUsers";
import GetUserById from "./GetUserById";
import RejectLeaveRequest from "./RejectLeaveRequest";
import AdminOnboardEmployee from "./AdminOnboardEmployee";
import GetMyProfilePicture from "./GetMyProfilePicture";
import UpdateMyProfilePicture from "./UpdateMyProfilePicture";
import DeleteMyProfilePicture from "./DeleteMyProfilePicture";
import GetMyCompany from "./GetMyCompany";
import UpdateMyCompany, { type UpdateCompanyRequestDTO } from "./UpdateMyCompany";
import GetMyCompanyLogo from "./GetMyCompanyLogo";
import UpdateMyCompanyLogo from "./UpdateMyCompanyLogo";
import DeleteMyCompanyLogo from "./DeleteMyCompanyLogo";
import GetMyPayslips, { type PayslipResponseDTO } from "./GetMyPayslips";
import GetAllPayslips from "./GetAllPayslips";
import GetPayslipsForReview from "./GetPayslipsForReview";
import UpdateMyPayslipFrequency, { type UpdatePayslipFrequencyRequestDTO } from "./UpdateMyPayslipFrequency";
import GetMyTimesheets, { type MyTimesheetRow } from "./GetMyTimesheets";
import GetAllTimesheets, { type TimesheetRow } from "./GetAllTimesheets";
import GetPayslipPdf from "./GetPayslipPdf";
import CreateTimesheet, { type CreateTimesheetRequestDTO, type CreateTimesheetResponseDTO } from "./CreateTimesheet";
import GetContracts, { type ContractResponseDTO } from "./GetContracts";
import ReportPayslipError, { type ReportPayslipErrorRequestDTO } from "./ReportPayslipError";
import GetPayslipById from "./GetPayslipById";
import UpdatePayslip, { type UpdatePayslipRequestDTO } from "./UpdatePayslip";
import GetUserProfilePicture from "./GetUserProfilePicture";
import GetPlanningOverview, {
    type PlanningDayDTO,
    type PlanningEventDTO,
    type PlanningResourceAllocationDTO,
    type PlanningShiftDTO,
} from "./GetPlanningOverview";
import CreatePlanningClient, {
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanySaveDTO,
} from "./CreatePlanningClient";
import GetPlanningClients, {
    type PlanningClientCompanyContactDTO,
    type PlanningClientCompanyDTO,
} from "./GetPlanningClients";
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
    LeaveRequestCreateDTO,
    LeaveRequestDTO,
    LeaveStatus,
    LeaveType,
    CompanyResponseDTO,
    UserResponseDTO,
} from "./Types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";

export type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
    LeaveRequestCreateDTO,
    LeaveRequestDTO,
    LeaveStatus,
    LeaveType,
    CompanyResponseDTO,
    PayslipResponseDTO,
    UpdatePayslipFrequencyRequestDTO,
    UserResponseDTO,
    UserSetupRequest,
    TimesheetRow,
    CreateTimesheetRequestDTO,
    CreateTimesheetResponseDTO,
    ContractResponseDTO,
    ReportPayslipErrorRequestDTO,
    UpdatePayslipRequestDTO,
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
};

export const UserServices = {
    adminOnboardEmployee: async (
        payload: AdminOnboardingRequestDTO
    ): Promise<AdminOnboardingResponseDTO> => {
        return await AdminOnboardEmployee(API_BASE_URL, payload);
    },
    getUsers: async (): Promise<UserResponseDTO[]> => {
        return await GetUsers(API_BASE_URL);
    },
    getUserById: async (userId: string): Promise<UserResponseDTO> => {
        return await GetUserById(API_BASE_URL, userId);
    },
    getMe: async (): Promise<UserResponseDTO> => {
        return await GetMe(API_BASE_URL);
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
    getTimesheets: async (): Promise<TimesheetRow[]> => {
        return await GetAllTimesheets(API_BASE_URL);
    },
    getContracts: async (): Promise<ContractResponseDTO[]> => {
        return await GetContracts(API_BASE_URL);
    },
    getPlanningOverview: async (companyId: string, eventId?: string): Promise<PlanningEventDTO[]> => {
        return await GetPlanningOverview(API_BASE_URL, companyId, eventId);
    },
    getPlanningClients: async (): Promise<PlanningClientCompanyDTO[]> => {
        return await GetPlanningClients(API_BASE_URL);
    },
    createPlanningClient: async (payload: PlanningClientCompanySaveDTO): Promise<PlanningClientCompanyDTO> => {
        return await CreatePlanningClient(API_BASE_URL, payload);
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
    getAllPayslips: async (): Promise<PayslipResponseDTO[]> => {
        return await GetAllPayslips(API_BASE_URL);
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
    updateMyProfilePicture: async (file: File): Promise<void> => {
        return await UpdateMyProfilePicture(API_BASE_URL, file);
    },
    deleteMyProfilePicture: async (): Promise<void> => {
        return await DeleteMyProfilePicture(API_BASE_URL);
    },
    completeSetup: async (payload: UserSetupRequest): Promise<void> => {
        return await CompleteSetup(API_BASE_URL, payload);
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
