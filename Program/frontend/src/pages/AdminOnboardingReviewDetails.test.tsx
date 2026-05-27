import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReviewContractDownloadAction } from "./AdminOnboardingReviewDetails";
import type { ContractResponseDTO } from "../services/user-service/UserServices";

function buildContract(overrides: Partial<ContractResponseDTO> = {}): ContractResponseDTO {
    return {
        contractId: "contract-1",
        userId: "user-1",
        status: "DRAFT",
        ...overrides,
    };
}

describe("AdminOnboardingReviewDetails contract download action", () => {
    it("shows a contract download button when a current contract exists", () => {
        const html = renderToStaticMarkup(
            <ReviewContractDownloadAction
                currentContract={buildContract()}
                actionLoading={false}
                onDownload={vi.fn()}
            />
        );

        expect(html).toContain("Download contract PDF");
    });

    it("renders nothing when there is no current contract", () => {
        const html = renderToStaticMarkup(
            <ReviewContractDownloadAction currentContract={null} actionLoading={false} onDownload={vi.fn()} />
        );

        expect(html).toBe("");
    });
});
