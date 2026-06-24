package com.pm.userservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.CaoUserAssignDTO;
import com.pm.userservice.dto.CompanyResponseDTO;
import com.pm.userservice.dto.OnboardingReviewContractSetupDraftDTO;
import com.pm.userservice.dto.OnboardingReviewUpdateDTO;
import com.pm.userservice.dto.AuditLogCreateRequestDTO;
import com.pm.userservice.dto.AuditLogMessagePartDTO;
import com.pm.userservice.dto.AuthRegisterRequestDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.dto.PayrollTaxTemplateDTO;
import com.pm.userservice.dto.PlatformCompanyDetailDTO;
import com.pm.userservice.dto.PlatformCompanyListItemDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingRequestDTO;
import com.pm.userservice.dto.PlatformCompanyOnboardingResponseDTO;
import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.dto.WorkHistoryColumnsPreferenceDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.integration.AuthServiceClient;
import com.pm.userservice.mapper.UserMapper;
import com.pm.userservice.model.CaoTemplate;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.User;
import com.pm.userservice.model.UserStatus;
import com.pm.userservice.repository.CaoTemplateRepository;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {
    private static final int TEMP_PASSWORD_LENGTH = 12;
    private static final String TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final Set<String> TIMESHEET_LOGGING_MODES = Set.of("AUTO_ON_SHIFT_END", "ADMIN_FINALIZE");
    private static final Set<String> TRAVEL_CLAIM_MODES = Set.of("AUTO_APPROVE", "REQUIRES_APPROVAL");
    private static final TypeReference<List<PayrollTaxTemplateDTO>> PAYROLL_TEMPLATE_LIST_TYPE =
            new TypeReference<>() {};
    private static final TypeReference<List<String>> STRING_LIST_TYPE =
            new TypeReference<>() {};
    private static final List<UserStatus> PLATFORM_PENDING_REVIEW_STATUSES = List.of(
            UserStatus.PENDING_PROFILE_REVIEW,
            UserStatus.CHANGES_REQUESTED,
            UserStatus.PENDING_CONTRACT_SIGNATURE,
            UserStatus.PENDING_CONTRACT_REVIEW
    );

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final CaoTemplateRepository caoTemplateRepository;
    private final UserDuplicateValidator userDuplicateValidator;
    private final ObjectMapper objectMapper;
    private final AuthServiceClient authServiceClient;
    @Autowired(required = false)
    private AuditLogService auditLogService;

    public record ProfilePicture(byte[] data, String contentType) {}
    public record CompanyLogo(byte[] data, String contentType) {}
    public record IdDocumentImage(byte[] data, String contentType) {}

    public UserService(UserRepository userRepository,
                       CompanyRepository companyRepository,
                       CaoTemplateRepository caoTemplateRepository,
                       UserDuplicateValidator userDuplicateValidator,
                       ObjectMapper objectMapper,
                       AuthServiceClient authServiceClient) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.caoTemplateRepository = caoTemplateRepository;
        this.userDuplicateValidator = userDuplicateValidator;
        this.objectMapper = objectMapper;
        this.authServiceClient = authServiceClient;
    }

    @Transactional(readOnly = true)
    public List<UserResponseDTO> getUsers(UUID companyId) {
        List<User> users = companyId != null
                ? userRepository.findAllByCompanyId(companyId)
                : userRepository.findAll();

        if (users.isEmpty()) {
            return List.of();
        }

        if (companyId != null) {
            Integer payoutFrequency = resolveCompanyPayoutFrequency(companyId);
            return users.stream()
                    .map(user -> toUserResponseDTO(user, payoutFrequency))
                    .toList();
        }

        Set<UUID> companyIds = users.stream()
                .map(User::getCompanyId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        var payoutByCompany = resolveCompanyPayoutFrequencies(companyIds);
        return users.stream()
                .map(user -> toUserResponseDTO(user, payoutByCompany.get(user.getCompanyId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponseDTO<UserResponseDTO> getUsersPage(UUID companyId, int page, int size, String sortKey, String sortDirection) {
        Pageable pageable = PageRequest.of(page, size, buildSort(sortKey, sortDirection));
        Page<User> users = companyId != null
                ? userRepository.findAllByCompanyId(companyId, pageable)
                : userRepository.findAll(pageable);

        if (users.isEmpty()) {
            return PagedResponseDTO.from(users, user -> toUserResponseDTO(user, null));
        }

        if (companyId != null) {
            Integer payoutFrequency = resolveCompanyPayoutFrequency(companyId);
            return PagedResponseDTO.from(users, user -> toUserResponseDTO(user, payoutFrequency));
        }

        Set<UUID> companyIds = users.getContent().stream()
                .map(User::getCompanyId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        var payoutByCompany = resolveCompanyPayoutFrequencies(companyIds);
        return PagedResponseDTO.from(users, user -> toUserResponseDTO(user, payoutByCompany.get(user.getCompanyId())));
    }

    @Transactional(readOnly = true)
    public List<PlatformCompanyListItemDTO> listPlatformCompanies() {
        return companyRepository.findAllByOrderByNameAsc().stream()
                .map(this::toPlatformCompanyListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlatformCompanyDetailDTO getPlatformCompany(UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        PlatformCompanyDetailDTO dto = new PlatformCompanyDetailDTO();
        applyPlatformCompanyFields(dto, company);
        return dto;
    }

    @Transactional
    public PlatformCompanyOnboardingResponseDTO onboardPlatformCompany(PlatformCompanyOnboardingRequestDTO request) {
        String temporaryPassword = generateTemporaryPassword();
        AuthRegisterRequestDTO authRequest = new AuthRegisterRequestDTO();
        authRequest.setFirstName(request.getAdminFirstNames());
        authRequest.setMiddleNamePrefix(request.getAdminMiddleNamePrefix());
        authRequest.setLastName(request.getAdminLastName());
        authRequest.setEmail(request.getAdminEmail());
        authRequest.setPassword(temporaryPassword);
        authRequest.setMustChangePassword(true);
        authRequest.setCompanyName(request.getCompanyName());

        var authResponse = authServiceClient.register(authRequest);

        PlatformCompanyOnboardingResponseDTO response = new PlatformCompanyOnboardingResponseDTO();
        response.setCompanyId(authResponse.getCompanyId());
        response.setCompanyName(request.getCompanyName());
        response.setAdminUserId(authResponse.getUserId());
        response.setAdminEmail(authResponse.getEmail());
        response.setUsername(authResponse.getUsername());
        response.setTemporaryPassword(temporaryPassword);
        return response;
    }

    @Transactional(readOnly = true)
    public List<UserResponseDTO> searchActiveUsers(UUID companyId, String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }

        int safeLimit = Math.min(Math.max(limit, 1), 50);
        Pageable pageable = PageRequest.of(
                0,
                safeLimit,
                Sort.by("lastName").ascending().and(Sort.by("firstNames").ascending())
        );

        Page<User> page = userRepository.searchUsers(companyId, UserStatus.ACTIVE, query.trim(), pageable);
        if (page.isEmpty()) {
            return List.of();
        }

        Integer payoutFrequency = companyId != null ? resolveCompanyPayoutFrequency(companyId) : null;
        return page.getContent().stream()
                .map(user -> toUserResponseDTO(user, payoutFrequency))
                .toList();
    }

    @Transactional(readOnly = true)
    public UserResponseDTO getUserById(UUID id, UUID companyId) {
        User user = companyId != null
                ? userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"))
                : userRepository.findByUserId(id)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        Integer payoutFrequency = user.getCompanyId() != null
                ? resolveCompanyPayoutFrequency(user.getCompanyId())
                : user.getPayslipFrequencyMinutes();
        return toUserResponseDTO(user, payoutFrequency);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, String> getDisplayNamesByUserIds(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return java.util.Map.of();
        }

        List<UUID> distinctUserIds = userIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (distinctUserIds.isEmpty()) {
            return java.util.Map.of();
        }

        java.util.Map<UUID, User> usersById = userRepository.findByUserIdIn(distinctUserIds).stream()
                .collect(Collectors.toMap(User::getUserId, user -> user));

        LinkedHashMap<String, String> displayNames = new LinkedHashMap<>();
        distinctUserIds.stream()
                .map(usersById::get)
                .filter(java.util.Objects::nonNull)
                .forEach(user -> displayNames.put(user.getUserId().toString(), buildDisplayName(user)));
        return displayNames;
    }

    @Transactional
    public UserResponseDTO updateUser(UUID id, UserRequestDTO userRequestDTO, UUID companyId) {
        User existing = companyId != null
                ? userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"))
                : userRepository.findByUserId(id)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));

        UUID scopedCompanyId = companyId != null ? companyId : existing.getCompanyId();
        userDuplicateValidator.validateNoDuplicate(id, scopedCompanyId, userRequestDTO);

        existing.setEmail(userRequestDTO.getEmail());
        existing.setPreferredName(userRequestDTO.getPreferredName());
        existing.setFirstNames(userRequestDTO.getFirstNames());
        existing.setMiddleNamePrefix(userRequestDTO.getMiddleNamePrefix());
        existing.setLastName(userRequestDTO.getLastName());
        existing.setGender(userRequestDTO.getGender());
        existing.setDateOfBirth(
                userRequestDTO.getDateOfBirth() != null
                        ? java.time.LocalDate.parse(userRequestDTO.getDateOfBirth())
                        : null
        );
        existing.setMobileNumber(userRequestDTO.getMobileNumber());
        existing.setStreet(userRequestDTO.getStreet());
        existing.setHouseNumber(userRequestDTO.getHouseNumber());
        existing.setHouseNumberSuffix(userRequestDTO.getHouseNumberSuffix());
        existing.setPostalCode(userRequestDTO.getPostalCode());
        existing.setCity(userRequestDTO.getCity());
        existing.setCountry(userRequestDTO.getCountry());
        existing.setIban(userRequestDTO.getIban());
        UserMapper.applyEmployeeTaxProfile(existing, userRequestDTO.getEmployeeTaxProfile());

        User updatedUser = userRepository.save(existing);
        Integer payoutFrequency = updatedUser.getCompanyId() != null
                ? resolveCompanyPayoutFrequency(updatedUser.getCompanyId())
                : updatedUser.getPayslipFrequencyMinutes();
        return UserMapper.toDTO(updatedUser, payoutFrequency);
    }

    @Transactional
    public UserResponseDTO updateCompanyPayoutFrequency(UUID userId, UUID companyId, int minutes) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        if (minutes <= 0) {
            throw new IllegalArgumentException("Payslip timing must be greater than 0 minutes");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));
        company.setPayoutFrequencyMinutes(minutes);
        companyRepository.save(company);

        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + userId + " not found"));
        Integer payoutFrequency = company.getPayoutFrequencyMinutes();
        return toUserResponseDTO(user, payoutFrequency);
    }

    @Transactional(readOnly = true)
    public CompanyResponseDTO getCompany(UUID companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));
        return toCompanyResponse(company);
    }

    @Transactional
    public CompanyResponseDTO updateCompany(
            UUID companyId,
            String name,
            Integer payoutFrequencyMinutes,
            String timesheetLoggingMode,
            String travelClaimMode,
            List<PayrollTaxTemplateDTO> payrollTaxTemplates,
            String street,
            String postalCode,
            String city
    ) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));

        if (name != null) {
            String trimmed = name.trim();
            if (trimmed.isBlank()) {
                throw new IllegalArgumentException("Company name is required");
            }
            Optional<Company> existingByName = companyRepository.findByName(trimmed);
            if (existingByName.isPresent() && !existingByName.get().getId().equals(companyId)) {
                throw new IllegalArgumentException("Company name already exists");
            }
            company.setName(trimmed);
        }

        if (payoutFrequencyMinutes != null) {
            if (payoutFrequencyMinutes <= 0) {
                throw new IllegalArgumentException("Payslip timing must be greater than 0 minutes");
            }
            company.setPayoutFrequencyMinutes(payoutFrequencyMinutes);
        }

        if (timesheetLoggingMode != null) {
            company.setTimesheetLoggingMode(normalizeSetting(
                    timesheetLoggingMode,
                    TIMESHEET_LOGGING_MODES,
                    "Invalid timesheet logging mode"
            ));
        }

        if (travelClaimMode != null) {
            company.setTravelClaimMode(normalizeSetting(
                    travelClaimMode,
                    TRAVEL_CLAIM_MODES,
                    "Invalid travel claim mode"
            ));
        }

        if (payrollTaxTemplates != null) {
            company.setPayrollTaxTemplatesJson(writePayrollTaxTemplates(payrollTaxTemplates));
        }

        if (street != null) {
            company.setStreet(blankToNull(street));
        }

        if (postalCode != null) {
            company.setPostalCode(blankToNull(postalCode));
        }

        if (city != null) {
            company.setCity(blankToNull(city));
        }

        return toCompanyResponse(companyRepository.save(company));
    }

    @Transactional(readOnly = true)
    public Optional<CompanyLogo> getCompanyLogo(UUID companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));
        byte[] data = company.getLogo();
        if (data == null || data.length == 0) return Optional.empty();
        return Optional.of(new CompanyLogo(data, company.getLogoContentType()));
    }

    @Transactional
    public void updateCompanyLogo(UUID companyId, byte[] data, String contentType) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));
        company.setLogo(data);
        company.setLogoContentType(contentType);
        companyRepository.save(company);
    }

    @Transactional
    public void removeCompanyLogo(UUID companyId) {
        if (companyId == null) {
            throw new IllegalArgumentException("Missing company");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalStateException("Company not found"));
        company.setLogo(null);
        company.setLogoContentType(null);
        companyRepository.save(company);
    }

    @Transactional(readOnly = true)
    public Optional<ProfilePicture> getProfilePicture(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        byte[] data = user.getProfilePicture();
        if (data == null || data.length == 0) return Optional.empty();
        return Optional.of(new ProfilePicture(data, user.getProfilePictureContentType()));
    }

    @Transactional
    public UserResponseDTO updateOnboardingReview(UUID id, UUID companyId, UUID actorUserId, OnboardingReviewUpdateDTO body) {
        User existing = companyId != null
                ? userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"))
                : userRepository.findByUserId(id)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));

        existing.setOnboardingReviewDecision(body.getDecision());
        existing.setOnboardingReviewNote(normalizeOptionalText(body.getNote()));

        if (body.getCheckedSections() != null) {
            existing.setOnboardingReviewCheckedSectionsJson(writeJsonSafely(body.getCheckedSections()));
        }

        if (body.getContractSetupDraft() != null) {
            existing.setOnboardingReviewContractSetupJson(writeJsonSafely(body.getContractSetupDraft()));
        }

        String rawStatus = normalizeOptionalText(body.getStatus());
        if (rawStatus != null) {
            existing.setStatus(UserStatus.valueOf(rawStatus.trim().toUpperCase()));
        }

        User updatedUser = userRepository.save(existing);
        recordAudit(
                companyId,
                actorUserId,
                "ONBOARDING",
                "REVIEWED",
                "USER",
                updatedUser.getUserId().toString(),
                List.of(
                        textPart(" reviewed onboarding for "),
                        linkPart("USER", updatedUser.getUserId().toString(), displayName(updatedUser), "/management/onboarding-review/" + updatedUser.getUserId())
                )
        );
        Integer payoutFrequency = updatedUser.getCompanyId() != null
                ? resolveCompanyPayoutFrequency(updatedUser.getCompanyId())
                : updatedUser.getPayslipFrequencyMinutes();
        return toUserResponseDTO(updatedUser, payoutFrequency);
    }

    @Transactional
    public UserResponseDTO assignUserCao(UUID id, UUID companyId, CaoUserAssignDTO body) {
        User existing = companyId != null
                ? userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"))
                : userRepository.findByUserId(id)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));

        if (body.getCaoId() == null || body.getCaoId().isBlank()) {
            existing.setAssignedCaoId(null);
            existing.setCaoVariableOverridesJson(null);
        } else {
            UUID caoId = UUID.fromString(body.getCaoId());
            existing.setAssignedCaoId(caoId);
            existing.setCaoVariableOverridesJson(writeJsonSafely(body.getOverrides()));
        }

        User updated = userRepository.save(existing);
        Integer payoutFrequency = updated.getCompanyId() != null
                ? resolveCompanyPayoutFrequency(updated.getCompanyId())
                : updated.getPayslipFrequencyMinutes();
        return toUserResponseDTO(updated, payoutFrequency);
    }

    @Transactional(readOnly = true)
    public WorkHistoryColumnsPreferenceDTO getWorkHistoryColumnsPreference(UUID userId) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + userId + " not found"));
        return new WorkHistoryColumnsPreferenceDTO(readStringList(user.getWorkHistoryColumnsJson()));
    }

    @Transactional
    public WorkHistoryColumnsPreferenceDTO updateWorkHistoryColumnsPreference(
            UUID userId,
            WorkHistoryColumnsPreferenceDTO preference
    ) {
        User user = userRepository.findByUserId(userId)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + userId + " not found"));
        List<String> columns = preference == null || preference.columns() == null ? List.of() : preference.columns();
        List<String> cleaned = columns.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
        user.setWorkHistoryColumnsJson(writeJsonSafely(cleaned));
        userRepository.save(user);
        return new WorkHistoryColumnsPreferenceDTO(cleaned);
    }

    private UserResponseDTO toUserResponseDTO(User user, Integer payoutFrequencyMinutes) {
        UserResponseDTO dto = UserMapper.toDTO(user, payoutFrequencyMinutes);
        if (dto == null || user == null) return dto;

        dto.setOnboardingReviewCheckedSections(readCheckedSections(user.getOnboardingReviewCheckedSectionsJson()));
        dto.setOnboardingReviewContractSetupDraft(readContractSetupDraft(user.getOnboardingReviewContractSetupJson()));

        if (user.getAssignedCaoId() != null) {
            caoTemplateRepository.findById(user.getAssignedCaoId())
                    .ifPresent(cao -> dto.setAssignedCaoName(cao.getName()));
        }

        return dto;
    }

    private java.util.Map<String, Boolean> readCheckedSections(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<HashMap<String, Boolean>>() {});
        } catch (Exception ignored) {
            return null;
        }
    }

    private OnboardingReviewContractSetupDraftDTO readContractSetupDraft(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, OnboardingReviewContractSetupDraftDTO.class);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<String> readStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, STRING_LIST_TYPE);
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String writeJsonSafely(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ignored) {
            return null;
        }
    }

    private static String normalizeOptionalText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void recordAudit(
            UUID companyId,
            UUID actorUserId,
            String category,
            String action,
            String entityType,
            String entityId,
            List<AuditLogMessagePartDTO> messageParts
    ) {
        if (auditLogService == null || companyId == null) {
            return;
        }
        AuditLogCreateRequestDTO request = new AuditLogCreateRequestDTO();
        request.setCategory(category);
        request.setAction(action);
        request.setEntityType(entityType);
        request.setEntityId(entityId);
        request.setMessageParts(messageParts);
        auditLogService.record(companyId, actorUserId, request);
    }

    private String displayName(User user) {
        String preferred = normalizeOptionalText(user.getPreferredName());
        if (preferred != null) {
            return preferred;
        }
        String combined = String.join(" ",
                user.getFirstNames() == null ? "" : user.getFirstNames(),
                user.getMiddleNamePrefix() == null ? "" : user.getMiddleNamePrefix(),
                user.getLastName() == null ? "" : user.getLastName()
        ).trim().replaceAll("\\s+", " ");
        return combined.isBlank() ? user.getEmail() : combined;
    }

    private static AuditLogMessagePartDTO textPart(String text) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("TEXT");
        part.setText(text);
        return part;
    }

    private static AuditLogMessagePartDTO linkPart(String entityType, String entityId, String label, String route) {
        AuditLogMessagePartDTO part = new AuditLogMessagePartDTO();
        part.setType("LINK");
        part.setEntityType(entityType);
        part.setEntityId(entityId);
        part.setLabel(label);
        part.setRoute(route);
        return part;
    }

    @Transactional(readOnly = true)
    public Optional<IdDocumentImage> getIdDocumentImage(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        byte[] data = user.getIdDocumentImage();
        if (data == null || data.length == 0) return Optional.empty();
        return Optional.of(new IdDocumentImage(data, user.getIdDocumentImageContentType()));
    }

    @Transactional(readOnly = true)
    public Optional<IdDocumentImage> getIdDocumentBackImage(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        byte[] data = user.getIdDocumentBackImage();
        if (data == null || data.length == 0) return Optional.empty();
        return Optional.of(new IdDocumentImage(data, user.getIdDocumentBackImageContentType()));
    }

    @Transactional
    public void updateProfilePicture(UUID id, byte[] data, String contentType) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        user.setProfilePicture(data);
        user.setProfilePictureContentType(contentType);
        userRepository.save(user);
    }

    @Transactional
    public void removeProfilePicture(UUID id) {
        User user = userRepository.findByUserId(id)
                .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
        user.setProfilePicture(null);
        user.setProfilePictureContentType(null);
        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(UUID id, UUID companyId, UUID actorUserId, String accessToken) {
        if (companyId != null) {
            User user = userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
            authServiceClient.deleteUserAccount(user.getUserId(), accessToken);
            userRepository.deleteByUserId(user.getUserId());
            recordAudit(
                    companyId,
                    actorUserId,
                    "PEOPLE",
                    "DELETED",
                    "USER",
                    user.getUserId().toString(),
                    List.of(
                            textPart(" deleted "),
                            linkPart("USER", user.getUserId().toString(), displayName(user), null)
                    )
            );
            return;
        }
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with id: " + id + " not found");
        }
        authServiceClient.deleteUserAccount(id, accessToken);
        userRepository.deleteByUserId(id);
    }

    private Integer resolveCompanyPayoutFrequency(UUID companyId) {
        return companyRepository.findById(companyId)
                .map(Company::getPayoutFrequencyMinutes)
                .orElse(null);
    }

    private CompanyResponseDTO toCompanyResponse(Company company) {
        CompanyResponseDTO dto = new CompanyResponseDTO();
        dto.setCompanyId(company.getId().toString());
        dto.setName(company.getName());
        dto.setPayoutFrequencyMinutes(company.getPayoutFrequencyMinutes());
        dto.setTimesheetLoggingMode(company.getTimesheetLoggingMode());
        dto.setTravelClaimMode(company.getTravelClaimMode());
        dto.setStreet(company.getStreet());
        dto.setPostalCode(company.getPostalCode());
        dto.setCity(company.getCity());
        dto.setPayrollTaxTemplates(readPayrollTaxTemplates(company.getPayrollTaxTemplatesJson()));
        return dto;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private PlatformCompanyListItemDTO toPlatformCompanyListItem(Company company) {
        PlatformCompanyListItemDTO dto = new PlatformCompanyListItemDTO();
        applyPlatformCompanyFields(dto, company);
        return dto;
    }

    private void applyPlatformCompanyFields(PlatformCompanyListItemDTO dto, Company company) {
        dto.setCompanyId(company.getId().toString());
        dto.setName(company.getName());
        dto.setPayoutFrequencyMinutes(company.getPayoutFrequencyMinutes());
        dto.setTimesheetLoggingMode(company.getTimesheetLoggingMode());
        dto.setTravelClaimMode(company.getTravelClaimMode());
        dto.setTotalUsers(toIntCount(userRepository.countByCompanyId(company.getId())));
        dto.setActiveUsers(toIntCount(userRepository.countByCompanyIdAndStatus(company.getId(), UserStatus.ACTIVE)));
        dto.setPendingOnboardingReview(toIntCount(
                userRepository.countByCompanyIdAndStatusIn(company.getId(), PLATFORM_PENDING_REVIEW_STATUSES)
        ));
    }

    private static int toIntCount(long value) {
        return Math.toIntExact(Math.min(value, Integer.MAX_VALUE));
    }

    private String normalizeSetting(String value, Set<String> allowed, String message) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private java.util.Map<UUID, Integer> resolveCompanyPayoutFrequencies(Set<UUID> companyIds) {
        if (companyIds == null || companyIds.isEmpty()) {
            return new HashMap<>();
        }
        return companyRepository.findAllById(companyIds).stream()
                .collect(Collectors.toMap(Company::getId, Company::getPayoutFrequencyMinutes));
    }

    private Sort buildSort(String sortKey, String sortDirection) {
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        String normalizedKey = sortKey == null ? "name" : sortKey.trim().toLowerCase();
        return switch (normalizedKey) {
            case "status" -> Sort.by(direction, "status").and(Sort.by(Sort.Direction.ASC, "lastName", "firstNames", "email"));
            case "position" -> Sort.by(direction, "position").and(Sort.by(Sort.Direction.ASC, "lastName", "firstNames", "email"));
            case "dateadded" -> Sort.by(direction, "registeredDate").and(Sort.by(Sort.Direction.ASC, "lastName", "firstNames", "email"));
            default -> Sort.by(direction, "lastName", "firstNames", "preferredName", "email");
        };
    }

    private String buildDisplayName(User user) {
        String fullName = java.util.stream.Stream.of(user.getFirstNames(), user.getMiddleNamePrefix(), user.getLastName())
                .map(value -> value == null ? "" : value.trim())
                .filter(value -> !value.isEmpty())
                .collect(Collectors.joining(" "));
        if (!fullName.isBlank()) {
            return fullName;
        }
        if (user.getPreferredName() != null && !user.getPreferredName().trim().isEmpty()) {
            return user.getPreferredName().trim();
        }
        return user.getEmail();
    }

    private List<PayrollTaxTemplateDTO> readPayrollTaxTemplates(String raw) {
        if (raw == null || raw.isBlank()) {
            return defaultPayrollTaxTemplates();
        }
        try {
            List<PayrollTaxTemplateDTO> templates = objectMapper.readValue(raw, PAYROLL_TEMPLATE_LIST_TYPE);
            return (templates == null || templates.isEmpty()) ? defaultPayrollTaxTemplates() : templates;
        } catch (Exception ignored) {
            return defaultPayrollTaxTemplates();
        }
    }

    private String writePayrollTaxTemplates(List<PayrollTaxTemplateDTO> payrollTaxTemplates) {
        try {
            return objectMapper.writeValueAsString(
                    payrollTaxTemplates == null ? List.of() : payrollTaxTemplates
            );
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Could not store payroll tax templates");
        }
    }

    private List<PayrollTaxTemplateDTO> defaultPayrollTaxTemplates() {
        return List.of(
                template("LOONHEFFING", "Loonheffing", "TAX", "FIXED_AMOUNT", "ALWAYS", 10),
                template("PENSION_EMPLOYEE", "Employee pension", "PENSION", "FIXED_AMOUNT", "PENSION_PARTICIPANT", 20),
                template("HOP_EMPLOYEE", "HOP employee contribution", "CAO", "FIXED_AMOUNT", "ALWAYS", 30),
                template("PAWW", "PAWW", "INSURANCE", "FIXED_AMOUNT", "ALWAYS", 40),
                template("ZVW_EMPLOYEE_SPECIAL", "Employee Zvw contribution", "TAX", "FIXED_AMOUNT", "SPECIAL_ZVW_CONTRIBUTION", 50),
                template("OTHER_DEDUCTION", "Other deduction", "OTHER", "FIXED_AMOUNT", "ALWAYS", 60)
        );
    }

    private PayrollTaxTemplateDTO template(
            String code,
            String label,
            String category,
            String calculationType,
            String employeeProfileTrigger,
            int sortOrder
    ) {
        PayrollTaxTemplateDTO dto = new PayrollTaxTemplateDTO();
        dto.setCode(code);
        dto.setLabel(label);
        dto.setCategory(category);
        dto.setCalculationType(calculationType);
        dto.setConfiguredValue(null);
        dto.setActive(false);
        dto.setSortOrder(sortOrder);
        dto.setNotes("");
        dto.setEmployeeProfileTrigger(employeeProfileTrigger);
        return dto;
    }

    private String generateTemporaryPassword() {
        SecureRandom random = new SecureRandom();
        StringBuilder password = new StringBuilder(TEMP_PASSWORD_LENGTH);
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            password.append(TEMP_PASSWORD_CHARS.charAt(random.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return password.toString();
    }
}
