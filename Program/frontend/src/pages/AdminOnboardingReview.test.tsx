import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OnboardingReviewQueueList } from "./AdminOnboardingReview";
import type { ContractResponseDTO, UserResponseDTO } from "../services/user-service/UserServices";

function buildUser(overrides: Partial<UserResponseDTO>): UserResponseDTO {
    return {
        userId: "user-1",
        email: "employee@example.com",
        preferredName: null,
        firstNames: "Employee",
        middleNamePrefix: null,
        lastName: "Example",
        gender: null,
        dateOfBirth: null,
        mobileNumber: null,
        position: null,
        workedForUsBefore: null,
        street: null,
        houseNumber: null,
        houseNumberSuffix: null,
        postalCode: null,
        city: null,
        country: null,
        iban: null,
        status: "PENDING_CONTRACT_REVIEW",
        registeredDate: "2026-05-27",
        ...overrides,
    };
}

function buildContract(overrides: Partial<ContractResponseDTO>): ContractResponseDTO {
    return {
        contractId: "contract-1",
        userId: "user-1",
        status: "DRAFT",
        ...overrides,
    };
}

describe("AdminOnboardingReview queue download column", () => {
    it("renders a download column and only shows a button for rows with a contract", () => {
        const users = [
            buildUser({
                userId: "user-1",
                email: "bevanrhee@gmail.com",
                firstNames: "Benjamin Eli",
                middleNamePrefix: "van",
                lastName: "Rhee",
            }),
            buildUser({
                userId: "user-2",
                email: "other@example.com",
                firstNames: "Mara",
                lastName: "Manager",
            }),
        ];
        const downloadableContracts = new Map<string, ContractResponseDTO>([
            ["user-1", buildContract({ contractId: "contract-bevan", userId: "user-1" })],
        ]);

        const html = renderToStaticMarkup(
            <OnboardingReviewQueueList
                reviewUsers={users}
                downloadableContracts={downloadableContracts}
                loading={false}
                error={null}
                downloadingContractId={null}
                onOpenReview={vi.fn()}
                onDownloadContract={vi.fn()}
            />
        );

        expect(html).toContain(">Download</div>");
        expect(html).toContain('aria-label="Download contract PDF for Benjamin Eli van Rhee"');
        expect(html).not.toContain('aria-label="Download contract PDF for Mara Manager"');
    });
});
