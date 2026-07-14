import { describe, expect, it } from "vitest";
import {
    buildAccountDocument,
    buildApplicationDocument,
    buildEmployeeProfileSections,
    documentFileBaseName,
    documentToHtml,
    escapeHtml,
    type DocumentModel,
} from "./documentPreview";
import type { JobApplicationResponseDTO, UserResponseDTO } from "../services/user-service/Types";
import type { ContractResponseDTO } from "../services/user-service/GetContracts";

function sectionByHeading(sections: ReturnType<typeof buildEmployeeProfileSections>, heading: string) {
    const section = sections.find((item) => item.heading === heading);
    if (!section || !("rows" in section)) throw new Error(`Missing section: ${heading}`);
    return section;
}

function rowValue(section: { rows: { label: string; value: string }[] }, label: string): string {
    const row = section.rows.find((item) => item.label === label);
    if (!row) throw new Error(`Missing row: ${label}`);
    return row.value;
}

const baseUser: UserResponseDTO = {
    userId: "u1",
    email: "jane@example.com",
    preferredName: null,
    firstNames: "Jane",
    middleNamePrefix: "van",
    lastName: "Doe",
    gender: "F",
    dateOfBirth: "1990-05-04",
    mobileNumber: "0612345678",
    position: "BAR",
    workedForUsBefore: false,
    street: "Main St",
    houseNumber: "10",
    houseNumberSuffix: null,
    postalCode: "1011AA",
    city: "Amsterdam",
    country: "Netherlands",
    iban: "NL00BANK0123456789",
    idDocumentType: "PASSPORT",
    idDocumentNumber: "X12345",
    idIssueDate: "2020-01-01",
    idExpirationDate: "2030-01-01",
    idIssuingCountry: "NL",
    status: "ACTIVE",
    employeeTaxProfile: { bsn: "123456782", applyLoonheffingskorting: true, pensionParticipant: true },
};

describe("escapeHtml", () => {
    it("escapes the HTML-significant characters", () => {
        expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe(
            "&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;"
        );
    });
});

describe("documentToHtml", () => {
    const model: DocumentModel = {
        title: "Test doc",
        subtitle: "Jane Doe",
        meta: [{ label: "Status", value: "Active" }],
        sections: [
            { heading: "Personal", rows: [{ label: "Name", value: "Jane" }] },
            { heading: "Notes", text: "line one\nline two" },
        ],
        footerNote: "Confidential",
    };

    it("renders the title, subtitle, brand, meta, sections and footer", () => {
        const html = documentToHtml(model, { generatedOn: new Date("2026-07-14T10:00:00Z") });
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("ParadePaard");
        expect(html).toContain("Test doc");
        expect(html).toContain("Jane Doe");
        expect(html).toContain("Status");
        expect(html).toContain("Personal");
        expect(html).toContain("Confidential");
        expect(html).toContain("Generated");
    });

    it("converts newlines in text sections to <br />", () => {
        const html = documentToHtml(model);
        expect(html).toContain("line one<br />line two");
    });

    it("escapes values so record data cannot inject markup", () => {
        const html = documentToHtml({
            title: "T",
            sections: [{ heading: "S", rows: [{ label: "L", value: "<img src=x onerror=alert(1)>" }] }],
        });
        expect(html).not.toContain("<img src=x");
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    });
});

describe("buildApplicationDocument", () => {
    const application: JobApplicationResponseDTO = {
        applicationId: "a1",
        firstNames: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phoneNumber: "0612345678",
        dateOfBirth: "1990-05-04",
        roleInterest: "Bar",
        contractPreference: "Fixed",
        workedForUsBefore: false,
        contactConsent: true,
        informationAccurate: true,
        status: "APPLICATION_SUBMITTED",
        note: "Available weekends",
    };

    it("uses the applicant name as subtitle and maps the personal section", () => {
        const doc = buildApplicationDocument(application);
        expect(doc.subtitle).toBe("Jane Doe");
        const personal = sectionByHeading(doc.sections, "Personal details");
        expect(rowValue(personal, "First names")).toBe("Jane");
        expect(rowValue(personal, "Date of birth")).toBe("04/05/1990");
        expect(rowValue(personal, "Worked for us before")).toBe("No");
    });

    it("includes a note section only when a note is present", () => {
        const withNote = buildApplicationDocument(application);
        expect(withNote.sections.some((s) => s.heading === "Applicant note")).toBe(true);
        const withoutNote = buildApplicationDocument({ ...application, note: null });
        expect(withoutNote.sections.some((s) => s.heading === "Applicant note")).toBe(false);
    });
});

describe("buildEmployeeProfileSections identification masking", () => {
    it("shows identification values when the reviewer may see them", () => {
        const sections = buildEmployeeProfileSections(baseUser, { canViewIdentification: true });
        expect(rowValue(sectionByHeading(sections, "Identification"), "Document number")).toBe("X12345");
        expect(rowValue(sectionByHeading(sections, "Tax information"), "BSN")).toBe("123456782");
    });

    it("masks present identification values but keeps empty as '-'", () => {
        const sections = buildEmployeeProfileSections(
            { ...baseUser, idIssuingCountry: null },
            { canViewIdentification: false }
        );
        const id = sectionByHeading(sections, "Identification");
        expect(rowValue(id, "Document number")).toBe("•••••");
        expect(rowValue(id, "Issuing country")).toBe("-");
        expect(rowValue(sectionByHeading(sections, "Tax information"), "BSN")).toBe("•••••");
    });
});

describe("buildAccountDocument", () => {
    const contract: ContractResponseDTO = {
        contractId: "c1",
        userId: "u1",
        functionName: "Bar employee",
        grossHourlyWage: 15,
        contractType: "PART_TIME",
        status: "FINALIZED",
        startDate: "2026-01-01",
        endDate: null,
    };

    it("appends the contract section and shows an open-ended end date", () => {
        const doc = buildAccountDocument({ user: baseUser, contract, canViewIdentification: true });
        const contractSection = sectionByHeading(doc.sections, "Contract");
        expect(rowValue(contractSection, "End date")).toBe("Open-ended");
        expect(rowValue(contractSection, "Gross hourly wage")).toContain("15");
    });

    it("notes when there is no contract on file", () => {
        const doc = buildAccountDocument({ user: baseUser, contract: null, canViewIdentification: true });
        const contractSection = sectionByHeading(doc.sections, "Contract");
        expect(rowValue(contractSection, "Contract")).toBe("No contract on file");
    });
});

describe("documentFileBaseName", () => {
    it("slugifies the name and prefixes it", () => {
        expect(documentFileBaseName("application", "Jane van Doe")).toBe("application-jane-van-doe");
    });

    it("falls back to the prefix when there is no name", () => {
        expect(documentFileBaseName("account", "  ")).toBe("account");
    });
});
