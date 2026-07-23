import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
    buildContractDraftPayload,
    canShowDeleteUserAction,
    canShowCreateContractDraft,
    canSubmitEmployerContractSignature,
    selectContractForReview,
} from "./AdminUserDetails";

const adminUserDetailsSource = readFileSync(
    fileURLToPath(new URL("./AdminUserDetails.tsx", import.meta.url)),
    "utf8"
);

describe("AdminUserDetails layout", () => {
    it("renders the detail tabs below the user overview card content", () => {
        const identityIndex = adminUserDetailsSource.indexOf('className="adminUserIdentity"');
        const tabsIndex = adminUserDetailsSource.indexOf('className="adminUserDetailsTabs"');

        expect(identityIndex).toBeGreaterThan(-1);
        expect(tabsIndex).toBeGreaterThan(-1);
        expect(tabsIndex).toBeGreaterThan(identityIndex);
    });
});

describe("AdminUserDetails contract finalization", () => {
    it("requires a loaded unfinalized contract, checked agreement, and typed manager name", () => {
        expect(canSubmitEmployerContractSignature({
            contractLoaded: false,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: true,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: false,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "   ",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(true);
    });
});

describe("AdminUserDetails contract draft creation", () => {
    it("allows contract managers to create a draft for accepted applicants without a current contract", () => {
        expect(canShowCreateContractDraft({
            canManageContracts: true,
            contractLoading: false,
            currentContract: null,
            userStatus: "PENDING_PROFILE_REVIEW",
        })).toBe(true);

        expect(canShowCreateContractDraft({
            canManageContracts: false,
            contractLoading: false,
            currentContract: null,
            userStatus: "PENDING_PROFILE_REVIEW",
        })).toBe(false);

        expect(canShowCreateContractDraft({
            canManageContracts: true,
            contractLoading: false,
            currentContract: { contractId: "existing", userId: "user-1" },
            userStatus: "PENDING_PROFILE_REVIEW",
        })).toBe(false);
    });

    it("builds a contract draft payload from the selected function and draft fields", () => {
        const payload = buildContractDraftPayload({
            userId: "user-1",
            functionId: "function-1",
            fallbackFunctionName: "Runner",
            functions: [
                {
                    functionId: "function-1",
                    functionName: "Bar",
                },
            ],
            draft: {
                functionName: "",
                functionGroup: "I+II",
                contractType: "ON_CALL",
                startDate: "2026-06-01",
                endDate: "",
                grossHourlyWage: "15.5",
                paymentFrequency: "WEEKLY",
                travelAllowance: true,
            },
        });

        expect(payload).toEqual({
            userId: "user-1",
            functionId: "function-1",
            functionName: "Bar",
            contractType: "ON_CALL",
            startDate: "2026-06-01",
            endDate: null,
            grossHourlyWage: 15.5,
            paymentFrequency: "WEEKLY",
            travelAllowance: true,
        });
    });

    it("prefers reviewable future contracts over only active-date contracts", () => {
        expect(selectContractForReview([
            {
                contractId: "finalized-old",
                userId: "user-1",
                status: "FINALIZED",
                startDate: "2026-01-01",
            },
            {
                contractId: "draft-future",
                userId: "user-1",
                status: "DRAFT",
                startDate: "2026-06-01",
            },
            {
                contractId: "signed-future",
                userId: "user-1",
                status: "SIGNED",
                startDate: "2026-07-01",
            },
        ])?.contractId).toBe("signed-future");
    });
});

describe("AdminUserDetails delete user action", () => {
    it("shows delete only for managers with delete permission viewing another user", () => {
        expect(canShowDeleteUserAction({
            permissions: ["CAN_DELETE_USERS"],
            currentManagerUserId: "manager-1",
            viewedUserId: "user-1",
        })).toBe(true);

        expect(canShowDeleteUserAction({
            permissions: ["CAN_MANAGE_USERS"],
            currentManagerUserId: "manager-1",
            viewedUserId: "user-1",
        })).toBe(false);

        expect(canShowDeleteUserAction({
            permissions: ["CAN_DELETE_USERS"],
            currentManagerUserId: "user-1",
            viewedUserId: "user-1",
        })).toBe(false);

        expect(canShowDeleteUserAction({
            permissions: ["CAN_DELETE_USERS"],
            currentManagerUserId: null,
            viewedUserId: "user-1",
        })).toBe(false);
    });
});
