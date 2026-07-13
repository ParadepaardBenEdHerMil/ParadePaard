import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContractDocumentPreview, canSubmitContractSignature } from "./AccountContractSign";

const contract = {
    contractId: "contract-1",
    userId: "user-1",
    functionName: "Runner",
    startDate: "2026-06-01",
    endDate: "2026-09-30",
    contractType: "ON_CALL_RUNNER",
    status: "SENT_TO_EMPLOYEE",
    grossHourlyWage: 14.5,
    travelAllowance: true,
    paymentFrequency: "WEEKLY",
    weeklyHours: 12,
    holidayAllowancePercentage: 8,
    leaveEntitlementDays: 20,
    workLocation: "ParadePaard events",
    noticePeriod: "One month",
    pensionScheme: "ParadePaard pension plan",
    sicknessPolicy: "Report sickness before the shift starts.",
    confidentialityClause: "Keep company and client information confidential.",
    employerTypedSignatureName: "Mara Manager",
};

const user = {
    userId: "user-1",
    email: "imre@example.com",
    preferredName: "Imre",
    firstNames: "Imre",
    middleNamePrefix: null,
    lastName: "Janssen",
    gender: null,
    dateOfBirth: "2000-01-01",
    mobileNumber: "0612345678",
    position: "RUNNER",
    workedForUsBefore: false,
    street: "Main Street",
    houseNumber: "10",
    houseNumberSuffix: null,
    postalCode: "1234 AB",
    city: "Amsterdam",
    country: "Netherlands",
    iban: "NL91ABNA0417164300",
    status: "PENDING_CONTRACT_SIGNATURE",
};

describe("AccountContractSign", () => {
    it("renders a document-style contract instead of raw field rows", () => {
        const html = renderToStaticMarkup(<ContractDocumentPreview contract={contract} user={user} />);

        expect(html).toContain("Employment Agreement");
        expect(html).toContain("This employment agreement is entered into between ParadePaard and Imre Janssen.");
        expect(html).toContain("The employee will work in the position of Runner.");
        expect(html).toContain("The gross hourly wage is");
        expect(html).toContain("Employer signature is prepared as Mara Manager.");
        expect(html).toContain("included when applicable under the Payroll and Contract Rules");
        expect(html).not.toContain("employeeName =");
        expect(html).not.toContain("hourlyRate =");
    });

    it("requires a loaded contract, checked agreement, and typed name before signing", () => {
        expect(canSubmitContractSignature({
            contractLoaded: false,
            alreadySigned: false,
            agreementChecked: true,
            typedName: "Imre Janssen",
            employeeFullName: "Imre Janssen",
        })).toBe(false);
        expect(canSubmitContractSignature({
            contractLoaded: true,
            alreadySigned: false,
            agreementChecked: false,
            typedName: "Imre Janssen",
            employeeFullName: "Imre Janssen",
        })).toBe(false);
        expect(canSubmitContractSignature({
            contractLoaded: true,
            alreadySigned: false,
            agreementChecked: true,
            typedName: "Imre Janssen",
            employeeFullName: "Imre Janssen",
        })).toBe(true);
    });
});
