const OWN_COMPANY_TOOLTIP = "You are already managing this company through your current account.";

type CompanyManagementActionProps = {
    selectedCompanyId: string;
    currentUserCompanyId: string | null | undefined;
    onOpen: () => void;
};

export default function CompanyManagementAction({
    selectedCompanyId,
    currentUserCompanyId,
    onOpen,
}: CompanyManagementActionProps) {
    const isOwnCompany = currentUserCompanyId === selectedCompanyId;
    const isDisabled = currentUserCompanyId === undefined || isOwnCompany;

    return (
        <span
            className="companyManagementAction"
            title={isOwnCompany ? OWN_COMPANY_TOOLTIP : undefined}
        >
            <button type="button" className="button" disabled={isDisabled} onClick={onOpen}>
                Open company management
            </button>
        </span>
    );
}
