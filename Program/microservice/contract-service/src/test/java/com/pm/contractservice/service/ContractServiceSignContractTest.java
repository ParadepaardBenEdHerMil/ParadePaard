package com.pm.contractservice.service;

import com.pm.contractservice.dto.SignContractRequestDTO;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.PaymentFrequency;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.repository.FunctionRepository;
import com.pm.contractservice.service.events.ContractEventPublisher;
import com.pm.contractservice.service.pdf.ContractPdfGenerator;
import com.pm.contractservice.validation.ContractValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import user.UserDataResponse;

@ExtendWith(MockitoExtension.class)
class ContractServiceSignContractTest {

    @Mock
    private ContractRepository contractRepository;
    @Mock
    private ContractValidator contractValidator;
    @Mock
    private UserServiceGrpcClient userServiceGrpcClient;
    @Mock
    private ContractEventPublisher contractEventPublisher;
    @Mock
    private ContractPdfGenerator contractPdfGenerator;
    @Mock
    private FunctionRepository functionRepository;
    @Mock
    private ContractNotificationService contractNotificationService;

    @Test
    void signContractStoresSignatureAuditDetailsAndLocksContractAsSigned() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build());
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Imre Janssen");
        request.setDrawnSignatureImage("data:image/png;base64,abc123");
        request.setAgreementCheckboxText("I have read the employment contract and agree to it.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash("sha256:contract-hash");
        request.setIpAddress("203.0.113.10");
        request.setBrowserUserAgent("Mozilla/5.0 Test Browser");

        ContractService service = contractService();
        service.signContract(contractId, userId, request);

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.SIGNED);
        assertThat(contract.getEmployeeSignedAt()).isNotNull();
        assertThat(contract.getSignedUserId()).isEqualTo(userId);
        assertThat(contract.getTypedSignatureName()).isEqualTo("Imre Janssen");
        assertThat(contract.getDrawnSignatureImage()).isEqualTo("data:image/png;base64,abc123");
        assertThat(contract.getAgreementCheckboxText()).isEqualTo("I have read the employment contract and agree to it.");
        assertThat(contract.getContractVersion()).isEqualTo("2026-05-employment-v1");
        assertThat(contract.getDocumentHash()).isEqualTo("sha256:contract-hash");
        assertThat(contract.getIpAddress()).isEqualTo("203.0.113.10");
        assertThat(contract.getBrowserUserAgent()).isEqualTo("Mozilla/5.0 Test Browser");
        assertThat(new String(contract.getPdfData())).isEqualTo("signed pdf");
    }

    @Test
    void getContractPdfRegeneratesSignedContractInsteadOfReturningCachedDraftPdf() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        contract.setStatus(ContractStatus.SIGNED);
        contract.setTypedSignatureName("Imre Clemens van Rhee");
        contract.setPdfData("old unsigned pdf".getBytes());
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setFirstNames("Imre Clemens")
                .setMiddleNamePrefix("van")
                .setLastName("Rhee")
                .build());
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("new signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        ContractService service = contractService();
        byte[] pdf = service.getContractPdf(contractId);

        assertThat(new String(pdf)).isEqualTo("new signed pdf");
        assertThat(new String(contract.getPdfData())).isEqualTo("new signed pdf");
        verify(contractPdfGenerator).generate(eq(contract), any());
    }

    @Test
    void getContractPdfRegeneratesSentContractInsteadOfReturningCachedLegacyPdf() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        contract.setStatus(ContractStatus.SENT_TO_EMPLOYEE);
        contract.setPdfData("legacy Dutch pdf".getBytes());
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setFirstNames("Imre Clemens")
                .setMiddleNamePrefix("van")
                .setLastName("Rhee")
                .build());
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("current English pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        ContractService service = contractService();
        byte[] pdf = service.getContractPdf(contractId);

        assertThat(new String(pdf)).isEqualTo("current English pdf");
        assertThat(new String(contract.getPdfData())).isEqualTo("current English pdf");
        verify(contractPdfGenerator).generate(eq(contract), any());
    }

    @Test
    void finalizeContractStoresEmployerSignatureAuditDetailsAndLocksContractAsFinalized() {
        UUID contractId = UUID.randomUUID();
        UUID employeeUserId = UUID.randomUUID();
        UUID managerUserId = UUID.randomUUID();
        Contract contract = contract(contractId, employeeUserId);
        contract.setStatus(ContractStatus.SIGNED);
        contract.setTypedSignatureName("Imre Janssen");
        contract.setEmployeeSignedAt(java.time.OffsetDateTime.now().minusHours(1));
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(userServiceGrpcClient.requestUserData(employeeUserId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build());
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("final signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Mara Manager");
        request.setDrawnSignatureImage("data:image/png;base64,manager123");
        request.setAgreementCheckboxText("I have reviewed the signed employment contract and approve it for ParadePaard.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash("sha256:manager-contract-hash");
        request.setIpAddress("203.0.113.20");
        request.setBrowserUserAgent("Mozilla/5.0 Manager Browser");

        ContractService service = contractService();
        service.finalizeContractById(contractId, managerUserId, request);

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.FINALIZED);
        assertThat(contract.getFinalizedAt()).isNotNull();
        assertThat(contract.getEmployerSignedUserId()).isEqualTo(managerUserId);
        assertThat(contract.getEmployerTypedSignatureName()).isEqualTo("Mara Manager");
        assertThat(contract.getEmployerDrawnSignatureImage()).isEqualTo("data:image/png;base64,manager123");
        assertThat(contract.getEmployerAgreementCheckboxText()).isEqualTo("I have reviewed the signed employment contract and approve it for ParadePaard.");
        assertThat(contract.getEmployerContractVersion()).isEqualTo("2026-05-employment-v1");
        assertThat(contract.getEmployerDocumentHash()).isEqualTo("sha256:manager-contract-hash");
        assertThat(contract.getEmployerIpAddress()).isEqualTo("203.0.113.20");
        assertThat(contract.getEmployerBrowserUserAgent()).isEqualTo("Mozilla/5.0 Manager Browser");
        assertThat(new String(contract.getPdfData())).isEqualTo("final signed pdf");
    }

    private ContractService contractService() {
        return new ContractService(
                contractRepository,
                contractValidator,
                userServiceGrpcClient,
                contractEventPublisher,
                contractPdfGenerator,
                functionRepository,
                contractNotificationService
        );
    }

    private static Contract contract(UUID contractId, UUID userId) {
        Contract contract = new Contract();
        contract.setContractId(contractId);
        contract.setUserId(userId);
        contract.setStartDate(LocalDate.of(2026, 5, 1));
        contract.setContractType(ContractType.ON_CALL_RUNNER);
        contract.setStatus(ContractStatus.SENT_TO_EMPLOYEE);
        contract.setGrossHourlyWage(new BigDecimal("18.50"));
        contract.setTravelAllowance(Boolean.TRUE);
        contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        return contract;
    }
}
