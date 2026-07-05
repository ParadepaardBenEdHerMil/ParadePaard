// @ts-ignore The app tsconfig does not include Node types, but Vitest runs this test in Node.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readProgramFile(pathFromProgram: string): string {
    return readFileSync(new URL(`../../../${pathFromProgram}`, import.meta.url), "utf8");
}

describe("development seed data clean slate", () => {
    it("keeps platform auth scaffolding without seeding a default admin login", () => {
        const authSchemaSql = readProgramFile("microservice/auth-service/src/main/resources/db/migration/V1__init_schema.sql");
        const authSeedSql = readProgramFile("microservice/auth-service/src/main/resources/db/migration/V2__seed_platform_reference_data.sql");

        expect(authSchemaSql).toContain("CREATE TABLE public.users");
        expect(authSchemaSql).not.toContain("INSERT INTO public.users");
        expect(authSeedSql).toContain("CAN_MANAGE_PLATFORM");
        expect(authSeedSql).toContain("SUPER_ADMIN");
        expect(authSeedSql).toContain("Platform Sandbox Company");
        [
            "sanne.admin",
            "testuser",
            "jane.doe",
            "joost.vanstam",
            "testcompany2",
            "anna.testcompany2",
            "ben.testcompany2",
        ].forEach((removedLogin) => {
            expect(authSeedSql).not.toContain(removedLogin);
        });
    });

    it("keeps user-service migrations schema-only and removes demo leave requests", () => {
        const userSql = readProgramFile("microservice/user-service/src/main/resources/db/migration/V1__init_schema.sql");

        expect(userSql).toContain("CREATE TABLE public.companies");
        expect(userSql).not.toContain("INSERT INTO companies");
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
        const timesheetSql = readProgramFile("microservice/timesheet-service/src/main/resources/db/migration/V1__init_schema.sql");
        const payrollSql = readProgramFile("microservice/payroll-service/src/main/resources/db/migration/V1__init_schema.sql");
        const contractSql = readProgramFile("microservice/contract-service/src/main/resources/db/migration/V1__init_schema.sql");

        expect(timesheetSql).not.toContain("INSERT INTO timesheets");
        expect(payrollSql).not.toContain("INSERT INTO payslips");
        expect(contractSql).not.toContain("INSERT INTO contracts");
        expect(timesheetSql).not.toContain("Alice Example");
        expect(payrollSql).not.toContain("Eve Senior");
        expect(contractSql).not.toContain("Joost");
    });
});
