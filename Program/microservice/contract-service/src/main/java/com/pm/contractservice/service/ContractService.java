package com.pm.contractservice.service;

import com.pm.contractservice.dto.ContractRequestDTO;
import com.pm.contractservice.dto.ContractResponseDTO;
import com.pm.contractservice.dto.ContractViewDTO;
import com.pm.contractservice.dto.UserProfileDTO;
import com.pm.contractservice.grpc.UserServiceGrpcClient;
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
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import user.UserDataResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
public class ContractService {

    private final ContractRepository contractRepository;
    private final ContractValidator contractValidator;
    private final UserServiceGrpcClient userServiceGrpcClient;
    private final ContractEventPublisher contractEventPublisher;
    private final ContractPdfGenerator contractPdfGenerator;
    private final FunctionRepository functionRepository;
    private final ContractNotificationService contractNotificationService;

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

    public List<ContractResponseDTO> getContractsForUser(UUID userId) {
        return contractRepository.findByUserIdOrderByStartDateDesc(userId)
                .stream()
                .map(ContractMapper::toDTO)
                .toList();
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

    public ContractResponseDTO createContract(ContractRequestDTO contractRequestDTO) {
        Contract contract = ContractMapper.toModel(contractRequestDTO);
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
        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO updateContract(UUID id, ContractRequestDTO contractRequestDTO) {
        Contract contract = contractValidator.getExistingContract(id);

        contract.setUserId(UUID.fromString(contractRequestDTO.getUserId()));
        if (contractRequestDTO.getFunctionId() != null && !contractRequestDTO.getFunctionId().isBlank()) {
            contract.setFunctionId(UUID.fromString(contractRequestDTO.getFunctionId()));
        } else {
            contract.setFunctionId(null);
        }
        contract.setFunctionName(contractRequestDTO.getFunctionName());
        contract.setStartDate(LocalDate.parse(contractRequestDTO.getStartDate()));
        contract.setEndDate(parseNullableDate(contractRequestDTO.getEndDate()));
        contract.setContractType(ContractType.valueOf(contractRequestDTO.getContractType()));
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
        return ContractMapper.toDTO(contract);
    }

    public void deleteContract(UUID id) {
        contractValidator.getExistingContract(id);
        contractRepository.deleteById(id);
    }

    public byte[] getContractPdf(UUID contractId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        if (contract.getPdfData() != null && contract.getPdfData().length > 0) {
            return contract.getPdfData();
        }

        UserProfileDTO profile = buildUserProfile(userServiceGrpcClient.requestUserData(contract.getUserId().toString()));
        byte[] pdfData = contractPdfGenerator.generate(contract, profile);
        contract.setPdfData(pdfData);
        contractRepository.save(contract);
        return pdfData;
    }

    public ContractViewDTO getContractView(UUID contractId) {
        Contract contract = contractValidator.getExistingContract(contractId);
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

        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO sendContract(UUID contractId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        contractNotificationService.sendContractReady(contract);
        contract.setStatus(ContractStatus.SENT_TO_EMPLOYEE);
        contract.setSentToEmployeeAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        return ContractMapper.toDTO(contractRepository.save(contract));
    }

    public ContractResponseDTO signContract(UUID contractId, UUID userId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        if (!contract.getUserId().equals(userId)) {
            throw new AccessDeniedException("Cannot sign another user's contract");
        }
        if (contract.getStatus() != ContractStatus.SENT_TO_EMPLOYEE && contract.getStatus() != ContractStatus.REJECTED) {
            throw new IllegalStateException("Contract is not waiting for employee signature");
        }
        contract.setStatus(ContractStatus.EMPLOYEE_SIGNED);
        contract.setEmployeeSignedAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        return ContractMapper.toDTO(contractRepository.save(contract));
    }

    public ContractResponseDTO finalizeContractById(UUID contractId) {
        Contract contract = contractValidator.getExistingContract(contractId);
        if (contract.getStatus() != ContractStatus.EMPLOYEE_SIGNED && contract.getStatus() != ContractStatus.SIGNED) {
            throw new IllegalStateException("Only employee-signed contracts can be finalized");
        }

        UserProfileDTO profile = buildUserProfile(userServiceGrpcClient.requestUserData(contract.getUserId().toString()));
        byte[] pdfData = contractPdfGenerator.generate(contract, profile);
        contract.setPdfData(pdfData);
        contract.setStatus(ContractStatus.FINALIZED);
        contract.setFinalizedAt(OffsetDateTime.now());
        contract.setReviewComment(null);
        contract = contractRepository.save(contract);

        contractEventPublisher.publishEmployeeRegistered(contract, profile);

        return ContractMapper.toDTO(contract);
    }

    public ContractResponseDTO rejectContract(UUID contractId, String comment) {
        if (comment == null || comment.isBlank()) {
            throw new IllegalArgumentException("Comment is required when rejecting a contract");
        }
        Contract contract = contractValidator.getExistingContract(contractId);
        contract.setStatus(ContractStatus.REJECTED);
        contract.setRejectedAt(OffsetDateTime.now());
        contract.setReviewComment(comment.trim());
        return ContractMapper.toDTO(contractRepository.save(contract));
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
}
