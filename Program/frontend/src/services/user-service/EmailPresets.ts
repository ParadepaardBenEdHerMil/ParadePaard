import axios from "axios";
import { extractApiErrorMessage } from "../../utils/apiError";

export type EmailPresetGroup = "SHIFTS" | "PROJECTS" | "USERS" | "APPLICATIONS" | "ONBOARDING";
export type EmailPresetCategory = "GENERAL" | "REJECT" | "REQUEST_CHANGES";

export type EmailPresetAttachmentDTO = {
    id: string;
    fileName: string;
    contentType?: string | null;
    sizeBytes: number;
};

export type EmailPresetResponseDTO = {
    id: string;
    groupType: EmailPresetGroup | string;
    category: EmailPresetCategory | string;
    name: string;
    subject: string;
    /** Rich HTML. */
    body: string;
    attachments?: EmailPresetAttachmentDTO[] | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

export type EmailPresetSaveDTO = {
    groupType: EmailPresetGroup | string;
    category?: EmailPresetCategory | string;
    name: string;
    subject: string;
    body: string;
};

export type EmailPresetSendResponseDTO = {
    requested: number;
    sent: number;
};

export async function GetEmailPresets(API_BASE_URL: string): Promise<EmailPresetResponseDTO[]> {
    const response = await axios.get<EmailPresetResponseDTO[]>(
        `${API_BASE_URL}/api/admin/email-presets`,
        { withCredentials: true }
    );
    return response.data;
}

export async function CreateEmailPreset(
    API_BASE_URL: string,
    payload: EmailPresetSaveDTO
): Promise<EmailPresetResponseDTO> {
    try {
        const response = await axios.post<EmailPresetResponseDTO>(
            `${API_BASE_URL}/api/admin/email-presets`,
            payload,
            { headers: { "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            throw new Error(extractApiErrorMessage(error, "Could not create the preset."));
        }
        throw error;
    }
}

export async function UpdateEmailPreset(
    API_BASE_URL: string,
    presetId: string,
    payload: EmailPresetSaveDTO
): Promise<EmailPresetResponseDTO> {
    try {
        const response = await axios.put<EmailPresetResponseDTO>(
            `${API_BASE_URL}/api/admin/email-presets/${presetId}`,
            payload,
            { headers: { "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            throw new Error(extractApiErrorMessage(error, "Could not update the preset."));
        }
        throw error;
    }
}

export async function DeleteEmailPreset(API_BASE_URL: string, presetId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/admin/email-presets/${presetId}`, {
        withCredentials: true,
    });
}

export async function UploadEmailPresetAttachment(
    API_BASE_URL: string,
    presetId: string,
    file: File
): Promise<EmailPresetAttachmentDTO> {
    try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await axios.post<EmailPresetAttachmentDTO>(
            `${API_BASE_URL}/api/admin/email-presets/${presetId}/attachments`,
            formData,
            { withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            throw new Error(extractApiErrorMessage(error, "Could not upload the attachment."));
        }
        throw error;
    }
}

export async function DeleteEmailPresetAttachment(
    API_BASE_URL: string,
    presetId: string,
    attachmentId: string
): Promise<void> {
    await axios.delete(
        `${API_BASE_URL}/api/admin/email-presets/${presetId}/attachments/${attachmentId}`,
        { withCredentials: true }
    );
}

export function emailPresetAttachmentUrl(
    API_BASE_URL: string,
    presetId: string,
    attachmentId: string
): string {
    return `${API_BASE_URL}/api/admin/email-presets/${presetId}/attachments/${attachmentId}`;
}

export async function GetEmailPresetAttachmentBlob(
    API_BASE_URL: string,
    presetId: string,
    attachmentId: string
): Promise<Blob> {
    const response = await axios.get(
        `${API_BASE_URL}/api/admin/email-presets/${presetId}/attachments/${attachmentId}`,
        { responseType: "blob", withCredentials: true }
    );
    return response.data as Blob;
}

export async function SendEmailPreset(
    API_BASE_URL: string,
    presetId: string,
    userIds: string[]
): Promise<EmailPresetSendResponseDTO> {
    try {
        const response = await axios.post<EmailPresetSendResponseDTO>(
            `${API_BASE_URL}/api/admin/email-presets/${presetId}/send`,
            { userIds },
            { headers: { "Content-Type": "application/json" }, withCredentials: true }
        );
        return response.data;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            throw new Error(extractApiErrorMessage(error, "Could not send the preset email."));
        }
        throw error;
    }
}
