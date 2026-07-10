package com.pm.contractservice.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pm.contractservice.dto.AuditLogCreateRequestDTO;
import com.pm.contractservice.integration.AuditLogClient;
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
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
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
    @Mock
    private AuditLogClient auditLogClient;

    @Test
    void signContractRejectsMismatchedDocumentHash() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build());
        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Imre Janssen");
        request.setAgreementCheckboxText("I have read the employment contract and agree to it.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash("sha256:not-the-real-hash");

        ContractService service = contractService();

        assertThatThrownBy(() -> service.signContract(contractId, userId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("document hash");
        verify(contractRepository, never()).save(contract);
    }

    @Test
    void signContractStoresSignatureAuditDetailsAndLocksContractAsSigned() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        UserDataResponse userData = UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build();
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(userData);
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Imre Janssen");
        request.setDrawnSignatureImage("data:image/png;base64,abc123");
        request.setAgreementCheckboxText("I have read the employment contract and agree to it.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash(employeeDocumentHash(contract, userData, request.getContractVersion()));
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
        assertThat(contract.getDocumentHash()).isEqualTo(request.getDocumentHash());
        assertThat(contract.getIpAddress()).isEqualTo("203.0.113.10");
        assertThat(contract.getBrowserUserAgent()).isEqualTo("Mozilla/5.0 Test Browser");
        assertThat(new String(contract.getPdfData())).isEqualTo("signed pdf");
    }

    @Test
    void signContractRecordsAuditEntryWhenAccessTokenIsAvailable() throws Exception {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        UserDataResponse userData = UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build();
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(userData);
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Imre Janssen");
        request.setAgreementCheckboxText("I agree.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash(employeeDocumentHash(contract, userData, request.getContractVersion()));

        ContractService service = contractService();
        injectAuditLogClient(service);
        service.signContract(contractId, userId, request, "access-token");

        verify(auditLogClient).record(eq("access-token"), argThat((AuditLogCreateRequestDTO auditRequest) ->
                auditRequest != null
                        && "CONTRACTS".equals(auditRequest.getCategory())
                        && "SIGNED".equals(auditRequest.getAction())
                        && contractId.toString().equals(auditRequest.getEntityId())
        ));
    }

    @Test
    void signContractAutoFinalizesWhenEmployerPreSignDataAlreadyExists() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        contract.setEmployerSignedUserId(UUID.randomUUID());
        contract.setEmployerTypedSignatureName("Mara Manager");
        contract.setEmployerDrawnSignatureImage("data:image/png;base64,manager123");
        contract.setEmployerAgreementCheckboxText("I have reviewed the signed employment contract and approve it for ParadePaard.");
        contract.setEmployerContractVersion("2026-05-employment-v1");
        contract.setEmployerDocumentHash("sha256:manager-contract-hash");
        contract.setEmployerIpAddress("203.0.113.20");
        contract.setEmployerBrowserUserAgent("Mozilla/5.0 Manager Browser");
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        UserDataResponse userData = UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build();
        when(userServiceGrpcClient.requestUserData(userId.toString())).thenReturn(userData);
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("final signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Imre Janssen");
        request.setDrawnSignatureImage("data:image/png;base64,abc123");
        request.setAgreementCheckboxText("I have read the employment contract and agree to it.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash(employeeDocumentHash(contract, userData, request.getContractVersion()));
        request.setIpAddress("203.0.113.10");
        request.setBrowserUserAgent("Mozilla/5.0 Test Browser");

        ContractService service = contractService();
        service.signContract(contractId, userId, request);

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.FINALIZED);
        assertThat(contract.getEmployeeSignedAt()).isNotNull();
        assertThat(contract.getFinalizedAt()).isNotNull();
        assertThat(new String(contract.getPdfData())).isEqualTo("final signed pdf");
        verify(contractEventPublisher).publishEmployeeRegistered(eq(contract), any());
    }

    @Test
    void prepareEmployerSignatureStoresEmployerAuditDetailsWithoutFinalizingContract() {
        UUID contractId = UUID.randomUUID();
        UUID employeeUserId = UUID.randomUUID();
        UUID managerUserId = UUID.randomUUID();
        Contract contract = contract(contractId, employeeUserId);
        contract.setStatus(ContractStatus.DRAFT);
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Mara Manager");
        request.setDrawnSignatureImage("data:image/png;base64,manager123");
        request.setAgreementCheckboxText("I have reviewed the signed employment contract and approve it for ParadePaard.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash(employerDocumentHash(contract, request.getContractVersion(), request.getTypedSignatureName()));
        request.setIpAddress("203.0.113.20");
        request.setBrowserUserAgent("Mozilla/5.0 Manager Browser");

        ContractService service = contractService();
        service.prepareEmployerSignature(contractId, managerUserId, request);

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.DRAFT);
        assertThat(contract.getFinalizedAt()).isNull();
        assertThat(contract.getEmployerSignedUserId()).isEqualTo(managerUserId);
        assertThat(contract.getEmployerTypedSignatureName()).isEqualTo("Mara Manager");
        assertThat(contract.getEmployerDrawnSignatureImage()).isEqualTo("data:image/png;base64,manager123");
        assertThat(contract.getEmployerAgreementCheckboxText()).isEqualTo("I have reviewed the signed employment contract and approve it for ParadePaard.");
        assertThat(contract.getEmployerContractVersion()).isEqualTo("2026-05-employment-v1");
        assertThat(contract.getEmployerDocumentHash()).isEqualTo(request.getDocumentHash());
        assertThat(contract.getEmployerIpAddress()).isEqualTo("203.0.113.20");
        assertThat(contract.getEmployerBrowserUserAgent()).isEqualTo("Mozilla/5.0 Manager Browser");
        verify(contractEventPublisher, never()).publishEmployeeRegistered(eq(contract), any());
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
    void getContractPdfReturnsStoredFinalPdfWithoutRegeneratingIt() {
        UUID contractId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        Contract contract = contract(contractId, userId);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setTypedSignatureName("Imre Clemens van Rhee");
        contract.setEmployerTypedSignatureName("Mara Manager");
        contract.setPdfData("locked final pdf with employer signature".getBytes());
        when(contractValidator.getExistingContract(contractId)).thenReturn(contract);

        ContractService service = contractService();
        byte[] pdf = service.getContractPdf(contractId);

        assertThat(new String(pdf)).isEqualTo("locked final pdf with employer signature");
        verify(contractPdfGenerator, never()).generate(eq(contract), any());
        verify(contractRepository, never()).save(contract);
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
        UserDataResponse userData = UserDataResponse.newBuilder()
                .setFirstNames("Imre")
                .setLastName("Janssen")
                .build();
        when(userServiceGrpcClient.requestUserData(employeeUserId.toString())).thenReturn(userData);
        when(contractPdfGenerator.generate(eq(contract), any())).thenReturn("final signed pdf".getBytes());
        when(contractRepository.save(contract)).thenReturn(contract);

        SignContractRequestDTO request = new SignContractRequestDTO();
        request.setTypedSignatureName("Mara Manager");
        request.setDrawnSignatureImage("data:image/png;base64,manager123");
        request.setAgreementCheckboxText("I have reviewed the signed employment contract and approve it for ParadePaard.");
        request.setContractVersion("2026-05-employment-v1");
        request.setDocumentHash(employerDocumentHash(contract, request.getContractVersion(), request.getTypedSignatureName()));
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
        assertThat(contract.getEmployerDocumentHash()).isEqualTo(request.getDocumentHash());
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
                contractNotificationService,
                new MinimumWageService(org.mockito.Mockito.mock(com.pm.contractservice.repository.MinimumWageRateRepository.class))
        );
    }

    private void injectAuditLogClient(ContractService service) throws Exception {
        Field field = ContractService.class.getDeclaredField("auditLogClient");
        field.setAccessible(true);
        field.set(service, auditLogClient);
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

    private static String employeeDocumentHash(Contract contract, UserDataResponse userData, String contractVersion) {
        ObjectNode source = JsonNodeFactory.instance.objectNode();
        putText(source, "contractVersion", contractVersion);
        putText(source, "contractId", asString(contract.getContractId()));
        putText(source, "userId", asString(contract.getUserId()));
        putText(source, "employeeName", employeeName(userData));
        putText(source, "functionName", contract.getFunctionName());
        putText(source, "startDate", asString(contract.getStartDate()));
        putText(source, "endDate", asString(contract.getEndDate()));
        putText(source, "contractType", contract.getContractType() == null ? null : contract.getContractType().name());
        putDecimal(source, "grossHourlyWage", contract.getGrossHourlyWage());
        putText(source, "paymentFrequency", contract.getPaymentFrequency() == null ? null : contract.getPaymentFrequency().name());
        putDecimal(source, "weeklyHours", contract.getWeeklyHours());
        putDecimal(source, "holidayAllowancePercentage", contract.getHolidayAllowancePercentage());
        putInteger(source, "leaveEntitlementDays", contract.getLeaveEntitlementDays());
        putText(source, "workLocation", contract.getWorkLocation());
        putText(source, "noticePeriod", contract.getNoticePeriod());
        return sha256(source.toString());
    }

    private static String employerDocumentHash(Contract contract, String contractVersion, String typedSignatureName) {
        ObjectNode source = JsonNodeFactory.instance.objectNode();
        putText(source, "contractVersion", contractVersion);
        putText(source, "contractId", asString(contract.getContractId()));
        putText(source, "userId", asString(contract.getUserId()));
        putText(source, "employerTypedSignatureName", typedSignatureName == null ? null : typedSignatureName.trim());
        putText(source, "employeeTypedSignatureName", contract.getTypedSignatureName());
        putText(source, "employeeSignedAt", asString(contract.getEmployeeSignedAt()));
        putText(source, "functionName", contract.getFunctionName());
        putText(source, "startDate", asString(contract.getStartDate()));
        putText(source, "endDate", asString(contract.getEndDate()));
        putText(source, "contractType", contract.getContractType() == null ? null : contract.getContractType().name());
        putDecimal(source, "grossHourlyWage", contract.getGrossHourlyWage());
        putText(source, "paymentFrequency", contract.getPaymentFrequency() == null ? null : contract.getPaymentFrequency().name());
        putDecimal(source, "weeklyHours", contract.getWeeklyHours());
        putDecimal(source, "holidayAllowancePercentage", contract.getHolidayAllowancePercentage());
        putInteger(source, "leaveEntitlementDays", contract.getLeaveEntitlementDays());
        putText(source, "workLocation", contract.getWorkLocation());
        putText(source, "noticePeriod", contract.getNoticePeriod());
        return sha256(source.toString());
    }

    private static String employeeName(UserDataResponse userData) {
        StringBuilder name = new StringBuilder();
        appendNamePart(name, userData == null ? null : userData.getFirstNames());
        appendNamePart(name, userData == null ? null : userData.getMiddleNamePrefix());
        appendNamePart(name, userData == null ? null : userData.getLastName());
        if (name.length() > 0) {
            return name.toString();
        }
        String preferredName = userData == null ? null : trimmedOrNull(userData.getPreferredName());
        return preferredName == null ? "Employee" : preferredName;
    }

    private static void appendNamePart(StringBuilder name, String value) {
        String trimmed = trimmedOrNull(value);
        if (trimmed == null) {
            return;
        }
        if (name.length() > 0) {
            name.append(' ');
        }
        name.append(trimmed);
    }

    private static void putText(ObjectNode node, String field, String value) {
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value);
        }
    }

    private static void putDecimal(ObjectNode node, String field, BigDecimal value) {
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value.stripTrailingZeros());
        }
    }

    private static void putInteger(ObjectNode node, String field, Integer value) {
        if (value == null) {
            node.putNull(field);
        } else {
            node.put(field, value);
        }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return "sha256:" + HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private static String trimmedOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
