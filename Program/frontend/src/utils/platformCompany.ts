import type { ActingCompany } from "../context/PlatformAdminContext";
import type { PlatformCompanyDetailDTO } from "../services/user-service/UserServices";

export function toActingCompany(company: PlatformCompanyDetailDTO): ActingCompany {
    return {
        companyId: company.companyId,
        companyName: company.name,
    };
}
