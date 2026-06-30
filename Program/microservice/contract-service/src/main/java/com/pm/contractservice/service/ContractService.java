package com.pm.contractservice.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pm.contractservice.dto.AuditLogCreateRequestDTO;
import com.pm.contractservice.dto.AuditLogMessagePartDTO;
import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.dto.ContractViewDTO;
import com.pm.contractservice.dto.RuleReplacementContractRequestDTO;
import com.pm.contractservice.dto.RuleReplacementContractResponseDTO;
import com.pm.contractservice.dto.SignContractRequestDTO;
import com.pm.contractservice.dto.UserProfileDTO;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
import com.pm.contractservice.integration.AuditLogClient;
import com.pm.contractservice.mapper.ContractMapper;
import com.pm.contractservice.exception.FunctionNotFoundException;
import com.pm.contractservice.model.Contract;
import com.pm.contractservice.model.ContractStatus;
import com.pm.contractservice.model.ContractType;
import com.pm.contractservice.model.Function;
import com.pm.contractservice.model.PaymentFrequency;
import com.pm.contractservice.repository.ContractRepository;
import com.pm.contractservice.repository.FunctionRepository;
import com.pm.contractservice.service.events.ContractEventPublisher;
import com.pm.contractservice.service.pdf.ContractPdfGenerator;
import com.pm.contractservice.validation.ContractValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class ContractService {
    private static final Logger log = LoggerFactory.getLogger(ContractService.class);

    private final ContractRepository contractRepository;
    private final ContractValidator contractValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractEventPublisher contractEventPublisher;
    private final ContractPdfGenerator contractPdfGenerator;
    private final FunctionRepository functionRepository;
    private final ContractNotificationService contractNotificationService;
    @Autowired(required = false)
    private AuditLogClient auditLogClient;

    // PY-19: development-only pay frequencies (EVERY_5/10_MINUTES) must be impossible
    // in production. Defaults to false (dev) so local smoke flows can still use them.
    @Value("${app.production:false}")
    private boolean productionEnvironment;

    public ContractService(ContractRepository contractRepository,
                           ContractValidator contractValidator,
                           UserServiceGrpcClient userServiceGrpcClient,
                           ContractEventPublisher contractEventPublisher,
                           ContractPdfGenerator contractPdfGenerator,
                           FunctionRepository functionRepository,
                           ContractNotificationService contractNotificationService) {
        this.contractRepository = contractRepository;
        this.contractValidator = contractValidator;
        this.userServiceGrpcClient = userServiceGrpcClient;
        this.contractEventPublisher = contractEventPublisher;
        this.contractPdfGenerator = contractPdfGenerator;
        this.functionRepository = functionRepository;
        this.contractNotificationService = contractNotificationService;
    }

    public List<ContractResponseDTO> getContracts() {
        return contractRepository.findAll()
                .stream()
                .map(ContractMapper::toDTO)
                .toList();
    }

    public List<ContractResponseDTO> getContracts(UUID companyId) {
        return contractRepository.findAll()
                .stream()
                .filter(contract -> belongsToCompany(contract.getUserId(), companyId))
                .map(ContractMapper::toDTO)
                .toList();
    }

    public List<ContractResponseDTO> getContractsForUser(UUID userId) {
        return contractRepository.findByUserIdOrderByStartDateDesc(userId)
                .stream()
                .map(ContractMapper::toDTO)
                .toList();
    }

    public List<ContractResponseDTO> getContractsForUser(UUID userId, UUID companyId) {
        requireUserInCompany(userId, companyId);
        return getContractsForUser(userId);
    }

    public ContractResponseDTO getCurrentContract(UUID userId, LocalDate date) {
        LocalDate effectiveDate = date == null ? LocalDate.now() : date;
        Contract contract = contractRepository.findActiveForPeriod(userId, effectiveDate, effectiveDate)
                .stream()
                .findFirst()
                .orElseThrow(() -> new com.pm.contractservice.exception.ContractNotFoundException(
                        "No active contract for " + userId + " on " + effectiveDate));
        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO getCurrentContract(UUID userId, LocalDate date, UUID companyId) {
        requireUserInCompany(userId, companyId);
        return getCurrentContract(userId, date);
    }

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO) {
        return createContract(contractRequestDTO, null);
    }

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO, String accessToken) {
        return createContract(contractRequestDTO, null, accessToken);
    }

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO, UUID companyId, String accessToken) {
        Contract contract = ContractMapper.toModel(contractRequestDTO);
        requireUserInCompany(contract.getUserId(), companyId);
        applyContractDefaults(contract, contractRequestDTO);
        contractValidator.ensureNoOverlappingContract(
                contract.getUserId(),
                contract.getStartDate(),
                contract.getEndDate(),
                null
        );
        contract.setStatus(ContractStatus.DRAFT);
        contract = contractRepository.save(contract);
        contractEventPublisher.publishContractCreated(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "CREATED",
                contract,
                List.of(
                        textPart(" created draft "),
                        contractLink(contract),
                        textPart(" for "),
                        userLink(contract.getUserId())
                )
        );
        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO) {
        return updateContract(id, contractRequestDTO, null);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO, String accessToken) {
        return updateContract(id, contractRequestDTO, null, accessToken);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO, UUID companyId, String accessToken) {
        Contract contract = contractValidator.getExistingContract(id);
        requireContractInCompany(contract, companyId);

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        requireUserInCompany(contract.getUserId(), companyId);
        if (contractRequestDTO.getFunctionId() != null && !contractRequestDTO.getFunctionId().isBlank()) {
            contract.setFunctionId(UUID.fromString(contractRequestDTO.getFunctionId()));
        } else {
            contract.setFunctionId(null);
        }
        contract.setFunctionName(contractRequestDTO.getFunctionName());
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        contract.setEndDate(parseNullableDate(contractRequestDTO.getEndDate()));
        contract.setContractType(ContractType.fromRequestValue(
                contractRequestDTO.getContractType(),
                contractRequestDTO.getFunctionName()
        ));
        contract.setGrossHourlyWage(contractRequestDTO.getGrossHourlyWage());
        contract.setTravelAllowance(contractRequestDTO.getTravelAllowance());
        contract.setPaymentFrequency(PaymentFrequency.fromNullable(contractRequestDTO.getPaymentFrequency()));
        contract.setWeeklyHours(contractRequestDTO.getWeeklyHours());
        contract.setHolidayAllowancePercentage(contractRequestDTO.getHolidayAllowancePercentage());
        contract.setLeaveEntitlementDays(contractRequestDTO.getLeaveEntitlementDays());
        contract.setWorkLocation(contractRequestDTO.getWorkLocation());
        contract.setProbationPeriod(contractRequestDTO.getProbationPeriod());
        contract.setNoticePeriod(contractRequestDTO.getNoticePeriod());
        contract.setCollectiveAgreement(contractRequestDTO.getCollectiveAgreement());
        contract.setPensionScheme(contractRequestDTO.getPensionScheme());
        contract.setSicknessPolicy(contractRequestDTO.getSicknessPolicy());
        contract.setConfidentialityClause(contractRequestDTO.getConfidentialityClause());
        applyContractDefaults(contract, contractRequestDTO);
        contractValidator.ensureNoOverlappingContract(
                contract.getUserId(),
                contract.getStartDate(),
                contract.getEndDate(),
                contract.getContractId()
        );

        contract = contractRepository.save(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "UPDATED",
                contract,
                List.of(
                        textPart(" updated "),
                        contractLink(contract),
                        textPart(" for "),
                        userLink(contract.getUserId())
                )
        );
        return ContractMapper.toDTO(contract);
    }

    public void deleteContract(UUID id) {
        deleteContract(id, null);
    }

    public void deleteContract(UUID id, String accessToken) {
        deleteContract(id, null, accessToken);
    }

    public void deleteContract(UUID id, UUID companyId, String accessToken) {
        Contract contract = contractValidator.getExistingContract(id);
        requireContractInCompany(contract, companyId);
        contractRepository.deleteById(id);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "DELETED",
                contract,
                List.of(
                        textPart(" deleted "),
                        contractLink(contract),
                        textPart(" for "),
                        userLink(contract.getUserId())
                )
        );
    }

    public byte[] getContractPdf(UUID contractId) {
        return getContractPdf(contractId, null);
    }

    public byte[] getContractPdf(UUID contractId, UUID companyId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        if (contract.getStatus() == ContractStatus.FINALIZED && contract.getPdfData() != null && contract.getPdfData().length > 0) {
            return contract.getPdfData();
        }
        return regenerateAndStorePdf(contract);
    }

    public ContractViewDTO getContractView(UUID contractId) {
        return getContractView(contractId, null);
    }

    public ContractViewDTO getContractView(UUID contractId, UUID companyId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        UserDataResponse userData = userServiceGrpcClient.requestUserData(contract.getUserId().toString());
        UserProfileDTO profile = buildUserProfile(userData);

        boolean previouslyWorked = contractRepository.existsByUserIdAndContractIdNot(
                contract.getUserId(),
                contract.getContractId()
        );

        ContractViewDTO view = new ContractViewDTO();
        view.setContractId(contract.getContractId());
        view.setUserId(contract.getUserId());
        view.setFunctionId(contract.getFunctionId());
        view.setFunctionName(contract.getFunctionName());
        view.setStartDate(contract.getStartDate());
        view.setEndDate(contract.getEndDate());
        view.setContractType(contract.getContractType());
        view.setStatus(contract.getStatus());
        view.setGrossHourlyWage(contract.getGrossHourlyWage());
        view.setTravelAllowance(contract.getTravelAllowance());
        view.setPaymentFrequency(contract.getPaymentFrequency() == null ? null : contract.getPaymentFrequency().name());
        view.setWeeklyHours(contract.getWeeklyHours());
        view.setHolidayAllowancePercentage(contract.getHolidayAllowancePercentage());
        view.setLeaveEntitlementDays(contract.getLeaveEntitlementDays());
        view.setWorkLocation(contract.getWorkLocation());
        view.setProbationPeriod(contract.getProbationPeriod());
        view.setNoticePeriod(contract.getNoticePeriod());
        view.setCollectiveAgreement(contract.getCollectiveAgreement());
        view.setPensionScheme(contract.getPensionScheme());
        view.setSicknessPolicy(contract.getSicknessPolicy());
        view.setConfidentialityClause(contract.getConfidentialityClause());
        view.setPreviouslyWorked(previouslyWorked);
        view.setUserProfile(profile);
        return view;
    }

    public ContractResponseDTO finalizeContract(UUID userId) {
        return finalizeContract(userId, null);
    }

    public ContractResponseDTO finalizeContract(UUID userId, String accessToken) {
        Contract contract = contractRepository.findByUserIdOrderByStartDateDesc(userId)
                .stream()
                .filter(candidate -> candidate.getStatus() == ContractStatus.DRAFT)
                .findFirst()
                .or(() -> contractRepository.findByUserIdOrderByStartDateDesc(userId).stream().findFirst())
                .orElseThrow(() -> new com.pm.contractservice.exception.ContractNotFoundException(
                        "Contract for " + userId + " not found"));

        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        UserProfileDTO profile = buildUserProfile(userData);

        byte[] pdfData = contractPdfGenerator.generate(contract, profile);
        contract.setPdfData(pdfData);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setFinalizedAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        contract = contractRepository.save(contract);

        contractEventPublisher.publishEmployeeRegistered(contract, profile);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "FINALIZED",
                contract,
                List.of(
                        textPart(" finalized "),
                        contractLink(contract)
                )
        );

        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO sendContract(UUID contractId) {
        return sendContract(contractId, null);
    }

    public ContractResponseDTO sendContract(UUID contractId, String accessToken) {
        return sendContract(contractId, null, accessToken);
    }

    public ContractResponseDTO sendContract(UUID contractId, UUID companyId, String accessToken) {
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        contractNotificationService.sendContractReady(contract);
        contract.setStatus(ContractStatus.SENT_TO_EMPLOYEE);
        contract.setSentToEmployeeAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        Contract saved = contractRepository.save(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "SENT",
                saved,
                List.of(
                        textPart(" sent "),
                        contractLink(saved),
                        textPart(" to "),
                        userLink(saved.getUserId())
                )
        );
        return ContractMapper.toDTO(saved);
    }

    public ContractResponseDTO prepareEmployerSignature(UUID contractId, UUID managerUserId, SignContractRequestDTO request) {
        return prepareEmployerSignature(contractId, managerUserId, request, null);
    }

    public ContractResponseDTO prepareEmployerSignature(UUID contractId, UUID managerUserId, SignContractRequestDTO request, String accessToken) {
        return prepareEmployerSignature(contractId, managerUserId, null, request, accessToken);
    }

    public ContractResponseDTO prepareEmployerSignature(
            UUID contractId,
            UUID managerUserId,
            UUID companyId,
            SignContractRequestDTO request,
            String accessToken
    ) {
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        if (contract.getStatus() == ContractStatus.FINALIZED || contract.getStatus() == ContractStatus.SIGNED || contract.getStatus() == ContractStatus.EMPLOYEE_SIGNED) {
            throw new IllegalStateException("Employer pre-sign can only be stored before employee signing is complete");
        }
        validateEmployerDocumentHash(contract, request);
        applyEmployerSignature(contract, managerUserId, request);
        contract.setReviewComment(null);
        Contract saved = contractRepository.save(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "EMPLOYER_SIGNED",
                saved,
                List.of(
                        textPart(" stored employer signature for "),
                        contractLink(saved),
                        textPart(" for "),
                        userLink(saved.getUserId())
                )
        );
        return ContractMapper.toDTO(saved);
    }

    public ContractResponseDTO signContract(UUID contractId, UUID userId) {
        return signContract(contractId, userId, new SignContractRequestDTO());
    }

    public ContractResponseDTO signContract(UUID contractId, UUID userId, SignContractRequestDTO request) {
        return signContract(contractId, userId, request, null);
    }

    public ContractResponseDTO signContract(UUID contractId, UUID userId, SignContractRequestDTO request, String accessToken) {
        Contract contract = contractValidator.getExistingContract(contractId);
        if (!contract.getUserId().equals(userId)) {
            throw new AccessDeniedException("Cannot sign another user's contract");
        }
        if (contract.getStatus() != ContractStatus.SENT_TO_EMPLOYEE && contract.getStatus() != ContractStatus.REJECTED) {
            throw new IllegalStateException("Contract is not waiting for employee signature");
        }
        if (request == null || isBlank(request.getTypedSignatureName())) {
            throw new IllegalArgumentException("Typed signature name is required");
        }
        if (request.getAgreementCheckboxText() == null || request.getAgreementCheckboxText().isBlank()) {
            throw new IllegalArgumentException("Agreement confirmation is required");
        }
        validateEmployeeDocumentHash(contract, request);
        contract.setStatus(ContractStatus.SIGNED);
        contract.setEmployeeSignedAt(OffsetDateTime.now());
        contract.setSignedUserId(userId);
        contract.setTypedSignatureName(request.getTypedSignatureName().trim());
        contract.setDrawnSignatureImage(blankToNull(request.getDrawnSignatureImage()));
        contract.setAgreementCheckboxText(request.getAgreementCheckboxText().trim());
        contract.setContractVersion(blankToNull(request.getContractVersion()));
        contract.setDocumentHash(blankToNull(request.getDocumentHash()));
        contract.setIpAddress(blankToNull(request.getIpAddress()));
        contract.setBrowserUserAgent(blankToNull(request.getBrowserUserAgent()));
        contract.setReviewComment(null);
        if (hasEmployerPreSignature(contract)) {
            contract.setStatus(ContractStatus.FINALIZED);
            contract.setFinalizedAt(OffsetDateTime.now());
            contract.setPdfData(generatePdf(contract));
            contract = contractRepository.save(contract);
            contractEventPublisher.publishEmployeeRegistered(
                    contract,
                    buildUserProfile(userServiceGrpcClient.requestUserData(contract.getUserId().toString()))
            );
            recordAudit(
                    accessToken,
                    "CONTRACTS",
                    "SIGNED_AND_FINALIZED",
                    contract,
                    List.of(
                            textPart(" signed and finalized "),
                            contractLink(contract)
                    )
            );
            return ContractMapper.toDTO(contract);
        }
        contract.setPdfData(generatePdf(contract));
        Contract saved = contractRepository.save(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "SIGNED",
                saved,
                List.of(
                        textPart(" signed "),
                        contractLink(saved)
                )
        );
        return ContractMapper.toDTO(saved);
    }

    public ContractResponseDTO finalizeContractById(UUID contractId) {
        return finalizeContractById(contractId, null, null);
    }

    public ContractResponseDTO finalizeContractById(UUID contractId, UUID managerUserId, SignContractRequestDTO request) {
        return finalizeContractById(contractId, managerUserId, request, null);
    }

    public ContractResponseDTO finalizeContractById(UUID contractId, UUID managerUserId, SignContractRequestDTO request, String accessToken) {
        return finalizeContractById(contractId, managerUserId, null, request, accessToken);
    }

    public ContractResponseDTO finalizeContractById(
            UUID contractId,
            UUID managerUserId,
            UUID companyId,
            SignContractRequestDTO request,
            String accessToken
    ) {
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        if (contract.getStatus() != ContractStatus.EMPLOYEE_SIGNED && contract.getStatus() != ContractStatus.SIGNED) {
            throw new IllegalStateException("Only employee-signed contracts can be finalized");
        }
        validateEmployerDocumentHash(contract, request);
        applyEmployerSignature(contract, managerUserId, request);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setFinalizedAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        contract.setPdfData(generatePdf(contract));
        contract = contractRepository.save(contract);

        contractEventPublisher.publishEmployeeRegistered(
                contract,
                buildUserProfile(userServiceGrpcClient.requestUserData(contract.getUserId().toString()))
        );
        recordAudit(
                accessToken,
                "CONTRACTS",
                "FINALIZED",
                contract,
                List.of(
                        textPart(" finalized "),
                        contractLink(contract),
                        textPart(" for "),
                        userLink(contract.getUserId())
                )
        );

        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO rejectContract(UUID contractId, String comment) {
        return rejectContract(contractId, comment, null);
    }

    public ContractResponseDTO rejectContract(UUID contractId, String comment, String accessToken) {
        return rejectContract(contractId, null, comment, accessToken);
    }

    public ContractResponseDTO rejectContract(UUID contractId, UUID companyId, String comment, String accessToken) {
        if (comment == null || comment.isBlank()) {
            throw new IllegalArgumentException("Comment is required when rejecting a contract");
        }
        Contract contract = contractValidator.getExistingContract(contractId);
        requireContractInCompany(contract, companyId);
        contract.setStatus(ContractStatus.REJECTED);
        contract.setRejectedAt(OffsetDateTime.now());
        contract.setReviewComment(comment.trim());
        Contract saved = contractRepository.save(contract);
        recordAudit(
                accessToken,
                "CONTRACTS",
                "REJECTED",
                saved,
                List.of(
                        textPart(" rejected "),
                        contractLink(saved),
                        textPart(" for "),
                        userLink(saved.getUserId())
                )
        );
        return ContractMapper.toDTO(saved);
    }

    public RuleReplacementContractResponseDTO createRuleReplacementDraft(RuleReplacementContractRequestDTO request) {
        return createRuleReplacementDraft(request, null);
    }

    public RuleReplacementContractResponseDTO createRuleReplacementDraft(RuleReplacementContractRequestDTO request, String accessToken) {
        return createRuleReplacementDraft(request, null, accessToken);
    }

    public RuleReplacementContractResponseDTO createRuleReplacementDraft(
            RuleReplacementContractRequestDTO request,
            UUID companyId,
            String accessToken
    ) {
        UUID userId = UUID.fromString(request.getUserId());
        requireUserInCompany(userId, companyId);
        LocalDate effectiveFrom = LocalDate.parse(request.getEffectiveFrom());
        UUID ruleVersionId = request.getRuleVersionId() == null || request.getRuleVersionId().isBlank()
                ? null
                : UUID.fromString(request.getRuleVersionId());

        Contract activeContract = contractRepository.findPayrollActiveForPeriod(userId, effectiveFrom, effectiveFrom)
                .stream()
                .findFirst()
                .orElseThrow(() -> new com.pm.contractservice.exception.ContractNotFoundException(
                        "No active finalized contract for " + userId + " on " + effectiveFrom));

        Contract draft = new Contract();
        draft.setUserId(activeContract.getUserId());
        draft.setFunctionId(activeContract.getFunctionId());
        draft.setFunctionName(activeContract.getFunctionName());
        draft.setStartDate(effectiveFrom);
        draft.setEndDate(activeContract.getEndDate());
        draft.setContractType(activeContract.getContractType());
        draft.setStatus(ContractStatus.DRAFT);
        draft.setGrossHourlyWage(
                request.getGrossHourlyWage() == null
                        ? activeContract.getGrossHourlyWage()
                        : request.getGrossHourlyWage()
        );
        draft.setTravelAllowance(activeContract.getTravelAllowance());
        draft.setPaymentFrequency(activeContract.getPaymentFrequency());
        draft.setWeeklyHours(activeContract.getWeeklyHours());
        draft.setHolidayAllowancePercentage(
                request.getHolidayAllowancePercentage() == null
                        ? activeContract.getHolidayAllowancePercentage()
                        : request.getHolidayAllowancePercentage()
        );
        draft.setLeaveEntitlementDays(activeContract.getLeaveEntitlementDays());
        draft.setWorkLocation(activeContract.getWorkLocation());
        draft.setProbationPeriod(activeContract.getProbationPeriod());
        draft.setNoticePeriod(activeContract.getNoticePeriod());
        draft.setCollectiveAgreement(
                isBlank(request.getCollectiveAgreement())
                        ? activeContract.getCollectiveAgreement()
                        : request.getCollectiveAgreement().trim()
        );
        draft.setPensionScheme(
                isBlank(request.getPensionScheme())
                        ? activeContract.getPensionScheme()
                        : request.getPensionScheme().trim()
        );
        draft.setSicknessPolicy(activeContract.getSicknessPolicy());
        draft.setConfidentialityClause(activeContract.getConfidentialityClause());
        draft.setReplacesContractId(activeContract.getContractId());
        draft.setDerivedFromRuleVersionId(ruleVersionId);
        if (request.getGrossHourlyWage() != null) {
            validateMinimumHourlyWage(draft);
        }

        Contract saved = contractRepository.save(draft);
        RuleReplacementContractResponseDTO response = new RuleReplacementContractResponseDTO();
        response.setContractId(saved.getContractId() == null ? null : saved.getContractId().toString());
        response.setUserId(saved.getUserId() == null ? null : saved.getUserId().toString());
        response.setReplacesContractId(saved.getReplacesContractId() == null ? null : saved.getReplacesContractId().toString());
        response.setDerivedFromRuleVersionId(
                saved.getDerivedFromRuleVersionId() == null ? null : saved.getDerivedFromRuleVersionId().toString()
        );
        response.setStartDate(saved.getStartDate() == null ? null : saved.getStartDate().toString());
        response.setStatus(saved.getStatus() == null ? null : saved.getStatus().name());
        recordAudit(
                accessToken,
                "CONTRACTS",
                "CREATED_REPLACEMENT_DRAFT",
                saved,
                List.of(
                        textPart(" created replacement draft "),
                        contractLink(saved),
                        textPart(" for "),
                        userLink(saved.getUserId())
                )
        );
        return response;
    }

    private void recordAudit(
            String accessToken,
            String category,
            String action,
            Contract contract,
            List<AuditLogMessagePartDTO> messageParts
    ) {
        if (auditLogClient == null || accessToken == null || accessToken.isBlank() || contract == null) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory(category);
        request.setAction(action);
        request.setEntityType("CONTRACT");
        request.setEntityId(contract.getContractId() == null ? null : contract.getContractId().toString());
        request.setMessageParts(messageParts);
        try {
            auditLogClient.record(accessToken, request);
        } catch (RuntimeException ex) {
            log.warn(
                    "Audit log recording failed for contract {} action {}",
                    request.getEntityId(),
                    action,
                    ex
            );
        }
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO userLink(UUID userId) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("USER");
        part.setEntityId(userId == null ? null : userId.toString());
        part.setRoute(userId == null ? null : "/management/users/" + userId);
        return part;
    }

    private static AuditLogMessagePartDTO contractLink(Contract contract) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType("CONTRACT");
        part.setEntityId(contract.getContractId() == null ? null : contract.getContractId().toString());
        part.setLabel(contractLabel(contract));
        part.setRoute(contract.getUserId() == null ? null : "/management/users/" + contract.getUserId());
        return part;
    }

    private static String contractLabel(Contract contract) {
        if (contract == null || contract.getStartDate() == null) {
            return "contract";
        }
        return "contract effective " + contract.getStartDate();
    }

    private void applyContractDefaults(Contract contract, ContractRequestDTO request) {
        Optional<Function> function = resolveFunction(request);
        function.ifPresent(job -> {
            contract.setFunctionId(job.getFunctionId());
            contract.setFunctionName(job.getFunctionName());
            if (contract.getGrossHourlyWage() == null) {
                contract.setGrossHourlyWage(job.getHourlyWage());
            }
        });

        if (isBlank(contract.getFunctionName())) {
            contract.setFunctionName(contractTypeDisplayName(contract.getContractType()));
        }
        if (contract.getGrossHourlyWage() == null) {
            throw new IllegalArgumentException("grossHourlyWage is required when no job position wage is available");
        }
        if (contract.getPaymentFrequency() == null) {
            contract.setPaymentFrequency(PaymentFrequency.WEEKLY);
        }
        if (productionEnvironment
                && contract.getPaymentFrequency() != null
                && !contract.getPaymentFrequency().isProductionAllowed()) {
            throw new IllegalArgumentException(
                    "Payment frequency " + contract.getPaymentFrequency()
                            + " is a development-only cycle and cannot be used in production");
        }
        validateMinimumHourlyWage(contract);
        if (contract.getHolidayAllowancePercentage() == null) {
            contract.setHolidayAllowancePercentage(new BigDecimal("8.00"));
        }
        if (contract.getLeaveEntitlementDays() == null) {
            contract.setLeaveEntitlementDays(20);
        }
        if (contract.getTravelAllowance() == null) {
            contract.setTravelAllowance(Boolean.FALSE);
        }
        if (isBlank(contract.getWorkLocation())) {
            contract.setWorkLocation("As agreed with the employer");
        }
        if (isBlank(contract.getNoticePeriod())) {
            contract.setNoticePeriod("Statutory Dutch notice periods apply unless otherwise agreed in writing.");
        }
        if (isBlank(contract.getSicknessPolicy())) {
            contract.setSicknessPolicy("The employee must report sickness according to the employer's absence policy and Dutch employment rules.");
        }
    }

    private Optional<Function> resolveFunction(ContractRequestDTO request) {
        if (request.getFunctionId() != null && !request.getFunctionId().isBlank()) {
            UUID functionId = UUID.fromString(request.getFunctionId());
            return Optional.of(functionRepository.findById(functionId)
                    .orElseThrow(() -> new FunctionNotFoundException("Function with id: " + functionId + " not found")));
        }
        if (request.getFunctionName() != null && !request.getFunctionName().isBlank()) {
            return functionRepository.findFirstByFunctionNameIgnoreCase(request.getFunctionName().trim());
        }
        return Optional.empty();
    }

    private byte[] regenerateAndStorePdf(Contract contract) {
        byte[] pdfData = generatePdf(contract);
        contract.setPdfData(pdfData);
        contractRepository.save(contract);
        return pdfData;
    }

    private byte[] generatePdf(Contract contract) {
        UserProfileDTO profile = buildUserProfile(userServiceGrpcClient.requestUserData(contract.getUserId().toString()));
        return contractPdfGenerator.generate(contract, profile);
    }

    private static void applyEmployerSignature(Contract contract, UUID managerUserId, SignContractRequestDTO request) {
        if (request == null || isBlank(request.getTypedSignatureName())) {
            throw new IllegalArgumentException("Employer typed signature name is required");
        }
        if (request.getAgreementCheckboxText() == null || request.getAgreementCheckboxText().isBlank()) {
            throw new IllegalArgumentException("Employer agreement confirmation is required");
        }
        contract.setEmployerSignedUserId(managerUserId);
        contract.setEmployerTypedSignatureName(request.getTypedSignatureName().trim());
        contract.setEmployerDrawnSignatureImage(blankToNull(request.getDrawnSignatureImage()));
        contract.setEmployerAgreementCheckboxText(request.getAgreementCheckboxText().trim());
        contract.setEmployerContractVersion(blankToNull(request.getContractVersion()));
        contract.setEmployerDocumentHash(blankToNull(request.getDocumentHash()));
        contract.setEmployerIpAddress(blankToNull(request.getIpAddress()));
        contract.setEmployerBrowserUserAgent(blankToNull(request.getBrowserUserAgent()));
    }

    private static boolean hasEmployerPreSignature(Contract contract) {
        return !isBlank(contract.getEmployerTypedSignatureName())
                && !isBlank(contract.getEmployerAgreementCheckboxText());
    }

    private void validateEmployeeDocumentHash(Contract contract, SignContractRequestDTO request) {
        String expectedHash = hashEmployeeDocument(contract, request);
        String actualHash = normalizedDocumentHash(request, "Employee");
        if (!expectedHash.equalsIgnoreCase(actualHash)) {
            throw new IllegalArgumentException("Employee document hash does not match current contract contents");
        }
    }

    private void validateEmployerDocumentHash(Contract contract, SignContractRequestDTO request) {
        String expectedHash = hashEmployerDocument(contract, request);
        String actualHash = normalizedDocumentHash(request, "Employer");
        if (!expectedHash.equalsIgnoreCase(actualHash)) {
            throw new IllegalArgumentException("Employer document hash does not match current contract contents");
        }
    }

    private String hashEmployeeDocument(Contract contract, SignContractRequestDTO request) {
        UserDataResponse userData = userServiceGrpcClient.requestUserData(contract.getUserId().toString());
        ObjectNode source = JsonNodeFactory.instance.objectNode();
        putText(source, "contractVersion", normalizedContractVersion(request, "Employee"));
        putText(source, "contractId", asString(contract.getContractId()));
        putText(source, "userId", asString(contract.getUserId()));
        putText(source, "employeeName", employeeDisplayName(userData));
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

    private String hashEmployerDocument(Contract contract, SignContractRequestDTO request) {
        ObjectNode source = JsonNodeFactory.instance.objectNode();
        putText(source, "contractVersion", normalizedContractVersion(request, "Employer"));
        putText(source, "contractId", asString(contract.getContractId()));
        putText(source, "userId", asString(contract.getUserId()));
        putText(source, "employerTypedSignatureName", blankToNull(request == null ? null : request.getTypedSignatureName()));
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

    private static String normalizedDocumentHash(SignContractRequestDTO request, String actor) {
        String hash = blankToNull(request == null ? null : request.getDocumentHash());
        if (hash == null) {
            throw new IllegalArgumentException(actor + " document hash is required");
        }
        return hash;
    }

    private static String normalizedContractVersion(SignContractRequestDTO request, String actor) {
        String version = blankToNull(request == null ? null : request.getContractVersion());
        if (version == null) {
            throw new IllegalArgumentException(actor + " contract version is required");
        }
        return version;
    }

    private static String employeeDisplayName(UserDataResponse userData) {
        if (userData == null) {
            return "Employee";
        }
        String[] parts = {
                blankToNull(userData.getFirstNames()),
                blankToNull(userData.getMiddleNamePrefix()),
                blankToNull(userData.getLastName())
        };
        StringBuilder displayName = new StringBuilder();
        for (String part : parts) {
            if (part == null) {
                continue;
            }
            if (displayName.length() > 0) {
                displayName.append(' ');
            }
            displayName.append(part);
        }
        if (displayName.length() > 0) {
            return displayName.toString();
        }
        String preferredName = blankToNull(userData.getPreferredName());
        return preferredName == null ? "Employee" : preferredName;
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
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }

    private void validateMinimumHourlyWage(Contract contract) {
        if (contract == null || contract.getUserId() == null || contract.getGrossHourlyWage() == null || contract.getStartDate() == null) {
            return;
        }

        UserDataResponse userData = userServiceGrpcClient.requestUserData(contract.getUserId().toString());
        if (userData == null || isBlank(userData.getDateOfBirth())) {
            throw new IllegalArgumentException("dateOfBirth is required to validate minimum wage");
        }

        LocalDate dateOfBirth = LocalDate.parse(userData.getDateOfBirth());
        Optional<BigDecimal> minimumHourlyWage = DutchMinimumWageSchedule.minimumHourlyWage(contract.getStartDate(), dateOfBirth);
        if (minimumHourlyWage.isPresent() && contract.getGrossHourlyWage().compareTo(minimumHourlyWage.get()) < 0) {
            throw new IllegalArgumentException(
                    "grossHourlyWage " + contract.getGrossHourlyWage()
                            + " is below Dutch minimum wage " + minimumHourlyWage.get()
                            + " for contract start date " + contract.getStartDate()
            );
        }
    }

    private UserProfileDTO buildUserProfile(UserDataResponse userData) {
        UserProfileDTO profile = new UserProfileDTO();
        profile.setPreferredName(userData.getPreferredName());
        profile.setFirstNames(userData.getFirstNames());
        profile.setMiddleNamePrefix(userData.getMiddleNamePrefix());
        profile.setLastName(userData.getLastName());
        profile.setGender(userData.getGender());
        profile.setDateOfBirth(userData.getDateOfBirth());
        profile.setEmail(userData.getEmail());
        profile.setMobileNumber(userData.getMobileNumber());
        profile.setStreetName(userData.getStreetName());
        profile.setHouseNumber(userData.getHouseNumber());
        profile.setHouseNumberSuffix(userData.getHouseNumberSuffix());
        profile.setPostalCode(userData.getPostalCode());
        profile.setCity(userData.getCity());
        profile.setCountry(userData.getCountry());
        profile.setIban(userData.getIban());
        return profile;
    }

    private static LocalDate parseNullableDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value);
    }

    private static String contractTypeDisplayName(ContractType contractType) {
        if (contractType == null) {
            return "Employee";
        }
        String[] parts = contractType.name().toLowerCase(Locale.ROOT).split("_+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return sb.toString();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void requireContractInCompany(Contract contract, UUID companyId) {
        if (contract == null || companyId == null) {
            return;
        }
        requireUserInCompany(contract.getUserId(), companyId);
    }

    private void requireUserInCompany(UUID userId, UUID companyId) {
        if (companyId == null || userId == null) {
            return;
        }
        if (!belongsToCompany(userId, companyId)) {
            throw new AccessDeniedException("Contract is not accessible in this company");
        }
    }

    private boolean belongsToCompany(UUID userId, UUID companyId) {
        if (companyId == null || userId == null) {
            return true;
        }
        UserDataResponse userData = userServiceGrpcClient.requestUserData(userId.toString());
        return companyId.toString().equals(userData.getCompanyId());
    }
}
