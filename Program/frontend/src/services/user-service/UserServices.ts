import ApproveLeaveRequest from "./ApproveLeaveRequest";
import CompleteSetup, { type UserSetupRequest } from "./CompleteSetup";
import CreateLeaveRequest from "./CreateLeaveRequest";
import GetLeaveRequests from "./GetLeaveRequests";
import GetLeaveRequestsByStatus from "./GetLeaveRequestsByStatus";
import GetListUserLeaveRequests from "./GetListUserLeaveRequests";
import GetMe from "./GetMe";
import GetUsers from "./GetUsers";
import RejectLeaveRequest from "./RejectLeaveRequest";
import AdminOnboardEmployee from "./AdminOnboardEmployee";
import GetMyProfilePicture from "./GetMyProfilePicture";
import UpdateMyProfilePicture from "./UpdateMyProfilePicture";
import DeleteMyProfilePicture from "./DeleteMyProfilePicture";
import type {
    AdminOnboardingRequestDTO,
    AdminOnboardingResponseDTO,
    LeaveRequestCreateDTO,
    LeaveRequestDTO,
    LeaveStatus,
    LeaveType,
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
    UserResponseDTO,
    UserSetupRequest,
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
    getMe: async (): Promise<UserResponseDTO> => {
        return await GetMe(API_BASE_URL);
    },
    getMyTimesheets: async (): Promise<
        Array<{
            timesheetId: string;
            dateOfIssue: string;
            function: string;
            hoursWorked: number;
        }>
    > => {
        await new Promise((r) => setTimeout(r, 350));

        const isoDate = (d: Date) => d.toISOString().slice(0, 10);
        const addDays = (d: Date, days: number) => {
            const copy = new Date(d);
            copy.setDate(copy.getDate() + days);
            return copy;
        };

        const today = new Date();
        return [
            {
                timesheetId: "TS-2025-11-001",
                dateOfIssue: isoDate(addDays(today, -3)),
                function: "Evening Bar Shift",
                hoursWorked: 6.5,
            },
            {
                timesheetId: "TS-2025-11-002",
                dateOfIssue: isoDate(addDays(today, -8)),
                function: "Runner Shift (Event A)",
                hoursWorked: 5.0,
            },
            {
                timesheetId: "TS-2025-10-003",
                dateOfIssue: isoDate(addDays(today, -14)),
                function: "Setup & Teardown",
                hoursWorked: 7.5,
            },
            {
                timesheetId: "TS-2025-10-004",
                dateOfIssue: isoDate(addDays(today, -21)),
                function: "Afternoon Bar Shift",
                hoursWorked: 4.0,
            },
            {
                timesheetId: "TS-2025-10-005",
                dateOfIssue: isoDate(addDays(today, -28)),
                function: "Runner Shift (Event B)",
                hoursWorked: 6.0,
            },
        ];
    },
    getMyProfilePicture: async (): Promise<Blob | null> => {
        return await GetMyProfilePicture(API_BASE_URL);
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
