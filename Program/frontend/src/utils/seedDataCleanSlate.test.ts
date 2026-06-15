// @ts-ignore The app tsconfig does not include Node types, but Vitest runs this test in Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProgramFile(pathFromProgram: string): string {
    return readFileSync(new URL(`../../../${pathFromProgram}`, import.meta.url), "utf8");
}

describe("development seed data clean slate", () => {
    it("keeps only the seeded platform admin login in auth seed users", () => {
        const authSql = readProgramFile("microservice/auth-service/src/main/resources/data.sql");

        expect(authSql).toContain("super.admin");
        expect(authSql).toContain("pardepaardtestemail1@gmail.com");
        expect(authSql).not.toContain("super.admin@example.com");
        expect(authSql).toContain("CAN_MANAGE_PLATFORM");
        expect(authSql).toContain("Platform Sandbox Company");
        [
            "sanne.admin",
            "testuser",
            "jane.doe",
            "joost.vanstam",
            "testcompany2",
            "anna.testcompany2",
            "ben.testcompany2",
        ].forEach((removedLogin) => {
            expect(authSql).not.toContain(removedLogin);
        });
    });

    it("keeps only the seeded platform company and platform admin in user-service seeds and removes demo leave requests", () => {
        const userSql = readProgramFile("microservice/user-service/src/main/resources/data.sql");

        expect(userSql).toContain("pardepaardtestemail1@gmail.com");
        expect(userSql).not.toContain("super.admin@example.com");
        expect(userSql).toContain("Platform Sandbox Company");
        expect(userSql).not.toContain("Default Company");
        expect(userSql).not.toContain("sanne.admin@example.com");
        expect(userSql).not.toContain("jane.doe@example.com");
        expect(userSql).not.toContain("mark.vos@example.com");
        expect(userSql).not.toContain("testuser@test.com");
        expect(userSql).not.toContain("joost.vanstam@example.com");
        expect(userSql).not.toContain("testcompany2");
        expect(userSql).not.toContain("INSERT INTO leave_requests");
    });

    it("does not create sample timesheets, payslips, or employee contracts", () => {
        const timesheetSql = readProgramFile("microservice/timesheet-service/src/main/resources/data.sql");
        const payrollSql = readProgramFile("microservice/payroll-service/src/main/resources/data.sql");
        const contractSql = readProgramFile("microservice/contract-service/src/main/resources/data.sql");

        expect(timesheetSql).not.toContain("INSERT INTO timesheets");
        expect(payrollSql).not.toContain("INSERT INTO payslips");
        expect(contractSql).not.toContain("INSERT INTO contracts");
        expect(timesheetSql).not.toContain("Alice Example");
        expect(payrollSql).not.toContain("Eve Senior");
        expect(contractSql).not.toContain("Joost");
    });
});
