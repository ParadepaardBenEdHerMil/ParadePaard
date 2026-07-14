package com.pm.userservice.service;

import com.pm.userservice.dto.AdminOnboardingRequestDTO;
import com.pm.userservice.dto.AdminOnboardingResponseDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserRequestDTO;
import com.pm.userservice.dto.AuthAdminOnboardUserResponseDTO;
import com.pm.userservice.dto.AuthRegisterRequestDTO;
import com.pm.userservice.dto.AuthRegisterResponseDTO;
import com.pm.userservice.dto.ContractDraftRequestDTO;
import com.pm.userservice.dto.ContractDraftResponseDTO;
import com.pm.userservice.dto.UserSetupRequestDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.exception.InvalidIdentifierException;
import com.pm.userservice.validation.DutchIdentifierValidator;
import com.pm.userservice.grpc.AuthServiceGrpcClient;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.integration.ContractServiceClient;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Locale;
import java.util.UUID;

@Service
public class OnboardingService {

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final AuthServiceClient authServiceClient;
    private final ContractServiceClient contractServiceClient;
    private final AuthServiceGrpcClient authServiceGrpcClient;

    public OnboardingService(UserRepository userRepository,
                             CompanyRepository companyRepository,
                             AuthServiceClient authServiceClient,
                             ContractServiceClient contractServiceClient,
                             AuthServiceGrpcClient authServiceGrpcClient) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.authServiceClient = authServiceClient;
        this.contractServiceClient = contractServiceClient;
        this.authServiceGrpcClient = authServiceGrpcClient;
    }

    @Transactional
    public AdminOnboardingResponseDTO adminOnboard(AdminOnboardingRequestDTO request, String accessToken) {
        AuthAdminOnboardUserRequestDTO authRequest = new AuthAdminOnboardUserRequestDTO();
        authRequest.setEmail(request.getEmail());
        authRequest.setFirstName(request.getFirstNames());
        authRequest.setLastName(buildAuthLastName(request));

        AuthAdminOnboardUserResponseDTO authResponse = authServiceClient.adminOnboardUser(authRequest, accessToken);
        if (authResponse == null || StringUtils.isBlank(authResponse.getUserId())) {
            throw new IllegalStateException("Auth service did not return a userId");
        }

        UUID userId = UUID.fromString(authResponse.getUserId());

        User user = new User();
        user.setUserId(userId);
        user.setEmail(request.getEmail());
        user.setPreferredName(request.getPreferredName());
        user.setFirstNames(request.getFirstNames());
        user.setMiddleNamePrefix(request.getMiddleNamePrefix());
        user.setLastName(request.getLastName());
        user.setGender(request.getGender());
        user.setDateOfBirth(request.getDateOfBirth() != null ? java.time.LocalDate.parse(request.getDateOfBirth()) : null);
        user.setMobileNumber(request.getMobileNumber());
        user.setPosition(request.getPosition());
        user.setWorkedForUsBefore(Boolean.TRUE.equals(request.getWorkedForUsBefore()));
        user.setStatus(UserStatus.PENDING_SETUP);
        UUID companyId = parseCompanyId(authResponse);
        if (companyId != null) {
            ensureCompany(companyId, request.getEmail());
            user.setCompanyId(companyId);
        }
        userRepository.save(user);

        ContractDraftRequestDTO contractRequest = new ContractDraftRequestDTO();
        contractRequest.setUserId(userId.toString());
        contractRequest.setFunctionId(StringUtils.trimToNull(request.getFunctionId()));
        contractRequest.setFunctionName(StringUtils.defaultIfBlank(
                request.getFunctionName(),
                mapPositionToFunctionName(request.getPosition())
        ));
        contractRequest.setStartDate(request.getStartDate());
        contractRequest.setEndDate(request.getEndDate());
        contractRequest.setContractType(mapContractType(request.getContractType(), request.getPosition()));
        contractRequest.setGrossHourlyWage(request.getGrossHourlyWage());
        contractRequest.setTravelAllowance(request.getTravelAllowance());
        contractRequest.setPaymentFrequency(StringUtils.defaultIfBlank(request.getPaymentFrequency(), "WEEKLY"));

        ContractDraftResponseDTO contractResponse = contractServiceClient.createDraftContract(contractRequest, accessToken);

        AdminOnboardingResponseDTO response = new AdminOnboardingResponseDTO();
        response.setUserId(userId.toString());
        response.setContractId(contractResponse != null ? contractResponse.getContractId() : null);
        response.setUsername(authResponse.getUsername());
        response.setTemporaryPassword(authResponse.getTemporaryPassword());
        return response;
    }

    @Transactional
    public void completeUserSetup(UUID userId, UserSetupRequestDTO request, String accessToken) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));

        // DV-2 / O-6 / O-8: reject identifiers that fail their checksum before persisting,
        // since invalid BSN/IBAN break tax filing and salary payment downstream.
        if (!DutchIdentifierValidator.isValidBsn(request.getBsn())) {
            throw new InvalidIdentifierException(
                    "The BSN you entered is not valid. Please check the 9-digit number and try again.");
        }
        if (!DutchIdentifierValidator.isValidIban(request.getIban())) {
            throw new InvalidIdentifierException(
                    "The IBAN you entered is not valid. Please check your bank account number and try again.");
        }

        user.setStreet(request.getStreet());
        user.setHouseNumber(request.getHouseNumber());
        user.setHouseNumberSuffix(request.getHouseNumberSuffix());
        user.setPostalCode(request.getPostalCode());
        user.setCity(request.getCity());
        user.setCountry(request.getCountry());
        user.setNationality(request.getNationality());
        user.setIban(request.getIban());
        user.setBankAccountHolderName(request.getBankAccountHolderName());
        user.setBsn(request.getBsn());
        user.setApplyLoonheffingskorting(Boolean.TRUE.equals(request.getApplyLoonheffingskorting()));
        user.setPensionParticipant(Boolean.TRUE.equals(request.getPensionParticipant()));
        user.setSpecialZvwContribution(Boolean.TRUE.equals(request.getSpecialZvwContribution()));
        user.setPayrollNotes(request.getPayrollNotes());
        user.setIdDocumentType(request.getIdDocumentType());
        user.setIdDocumentNumber(request.getIdDocumentNumber());
        user.setIdIssueDate(LocalDate.parse(request.getIdIssueDate()));
        user.setIdExpirationDate(LocalDate.parse(request.getIdExpirationDate()));
        user.setIdIssuingCountry(request.getIdIssuingCountry());
        user.setEmergencyContactName(request.getEmergencyContactName());
        user.setEmergencyContactRelationship(request.getEmergencyContactRelationship());
        user.setEmergencyContactPhone(request.getEmergencyContactPhone());
        user.setEmergencyContactEmail(request.getEmergencyContactEmail());

        // The employee has resubmitted, so any prior review flags/note are stale. Clear them
        // so the next admin review starts from a clean slate instead of showing old feedback.
        user.setOnboardingReviewFieldFlagsJson(null);
        user.setOnboardingReviewNote(null);

        user.setStatus(UserStatus.PENDING_PROFILE_REVIEW);
        userRepository.save(user);
    }

    @Transactional
    public void updateIdDocumentImages(UUID userId,
                                       byte[] frontBytes,
                                       String frontContentType,
                                       byte[] backBytes,
                                       String backContentType) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User " + userId + " not found"));
        user.setIdDocumentImage(frontBytes);
        user.setIdDocumentImageContentType(frontContentType);
        user.setIdDocumentBackImage(backBytes);
        user.setIdDocumentBackImageContentType(backContentType);
        userRepository.save(user);
    }

    private static String buildFullName(AdminOnboardingRequestDTO request) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.isNotBlank(request.getFirstNames())) {
            sb.append(request.getFirstNames().trim());
        }
        if (StringUtils.isNotBlank(request.getMiddleNamePrefix())) {
            if (sb.length() > 0) {
                sb.append(" ");
            }
            sb.append(request.getMiddleNamePrefix().trim());
        }
        if (StringUtils.isNotBlank(request.getLastName())) {
            if (sb.length() > 0) {
                sb.append(" ");
            }
            sb.append(request.getLastName().trim());
        }
        String fullName = sb.toString();
        if (StringUtils.isBlank(fullName)) {
            throw new IllegalArgumentException("Full name required to generate username");
        }
        return fullName;
    }

    private static String buildAuthLastName(AdminOnboardingRequestDTO request) {
        String prefix = request.getMiddleNamePrefix();
        String lastName = request.getLastName();
        if (StringUtils.isBlank(prefix)) {
            return lastName == null ? "" : lastName.trim();
        }
        if (StringUtils.isBlank(lastName)) {
            return prefix.trim();
        }
        return prefix.trim() + " " + lastName.trim();
    }

    private UUID parseCompanyId(AuthAdminOnboardUserResponseDTO authResponse) {
        if (authResponse == null || StringUtils.isBlank(authResponse.getCompanyId())) {
            return null;
        }
        return UUID.fromString(authResponse.getCompanyId().trim());
    }

    private void ensureCompany(UUID companyId, String email) {
        if (companyRepository.findById(companyId).isPresent()) {
            return;
        }
        Company company = new Company();
        company.setId(companyId);
        company.setName(deriveCompanyName(email));
        companyRepository.save(company);
    }

    private static String deriveCompanyName(String email) {
        if (StringUtils.isBlank(email)) {
            return "Company";
        }
        int at = email.indexOf('@');
        if (at > -1 && at < email.length() - 1) {
            return email.substring(at + 1).trim();
        }
        return "Company";
    }

    private static String mapContractType(String rawContractType, String rawPosition) {
        String contractType = rawContractType == null ? "" : rawContractType.trim().toUpperCase(Locale.ROOT);
        String position = rawPosition == null ? "" : rawPosition.trim().toUpperCase(Locale.ROOT);

        if (contractType.equals("FIXED") || contractType.equals("FIXED_HOURS")) {
            return "FIXED_HOURS";
        }

        if (contractType.equals("ON_CALL") || contractType.startsWith("ON_CALL")) {
            if (position.contains("BAR")) return "ON_CALL_BAR";
            if (position.contains("RUNNER")) return "ON_CALL_RUNNER";
            return "ON_CALL_RUNNER";
        }

        return contractType;
    }

    private static String mapPositionToFunctionName(String rawPosition) {
        String position = rawPosition == null ? "" : rawPosition.trim().toUpperCase(Locale.ROOT);
        if (position.contains("BAR")) {
            return "Bar";
        }
        if (position.contains("RUNNER")) {
            return "Runner";
        }
        if (position.contains("SUPERVISOR")) {
            return "Supervisor";
        }
        return rawPosition;
    }
}
