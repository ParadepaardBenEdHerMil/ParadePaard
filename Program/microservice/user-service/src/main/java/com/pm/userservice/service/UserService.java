package com.pm.userservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pm.userservice.dto.CompanyResponseDTO;
import com.pm.userservice.dto.PagedResponseDTO;
import com.pm.userservice.dto.PayrollTaxTemplateDTO;
import com.pm.userservice.dto.UserRequestDTO;
import com.pm.userservice.dto.UserResponseDTO;
import com.pm.userservice.exception.UserNotFoundException;
import com.pm.userservice.mapper.UserMapper;
import com.pm.userservice.model.Company;
import com.pm.userservice.model.User;
import com.pm.userservice.repository.CompanyRepository;
import com.pm.userservice.repository.UserRepository;
import com.pm.userservice.validation.UserDuplicateValidator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {
    private static final Set<String> TIMESHEET_LOGGING_MODES = Set.of("AUTO_ON_SHIFT_END", "ADMIN_FINALIZE");
    private static final Set<String> TRAVEL_CLAIM_MODES = Set.of("AUTO_APPROVE", "REQUIRES_APPROVAL");
    private static final TypeReference<List<PayrollTaxTemplateDTO>> PAYROLL_TEMPLATE_LIST_TYPE =
            new TypeReference<>() {};

    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final UserDuplicateValidator userDuplicateValidator;
    private final ObjectMapper objectMapper;

    public record ProfilePicture(byte[] data, String contentType) {}
    public record CompanyLogo(byte[] data, String contentType) {}

    public UserService(UserRepository userRepository,
                       CompanyRepository companyRepository,
                       UserDuplicateValidator userDuplicateValidator,
                       ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.companyRepository = companyRepository;
        this.userDuplicateValidator = userDuplicateValidator;
        this.objectMapper = objectMapper;
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
                    .map(user -> UserMapper.toDTO(user, payoutFrequency))
                    .toList();
        }

        Set<UUID> companyIds = users.stream()
                .map(User::getCompanyId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        var payoutByCompany = resolveCompanyPayoutFrequencies(companyIds);
        return users.stream()
                .map(user -> UserMapper.toDTO(user, payoutByCompany.get(user.getCompanyId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponseDTO<UserResponseDTO> getUsersPage(UUID companyId, int page, int size, String sortKey, String sortDirection) {
        Pageable pageable = PageRequest.of(page, size, buildSort(sortKey, sortDirection));
        Page<User> users = companyId != null
                ? userRepository.findAllByCompanyId(companyId, pageable)
                : userRepository.findAll(pageable);

        if (users.isEmpty()) {
            return PagedResponseDTO.from(users, user -> UserMapper.toDTO(user, null));
        }

        if (companyId != null) {
            Integer payoutFrequency = resolveCompanyPayoutFrequency(companyId);
            return PagedResponseDTO.from(users, user -> UserMapper.toDTO(user, payoutFrequency));
        }

        Set<UUID> companyIds = users.getContent().stream()
                .map(User::getCompanyId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        var payoutByCompany = resolveCompanyPayoutFrequencies(companyIds);
        return PagedResponseDTO.from(users, user -> UserMapper.toDTO(user, payoutByCompany.get(user.getCompanyId())));
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
        return UserMapper.toDTO(user, payoutFrequency);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, String> getDisplayNamesByUserIds(List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return java.util.Map.of();
        }

        LinkedHashMap<String, String> displayNames = new LinkedHashMap<>();
        userIds.stream()
                .filter(java.util.Objects::nonNull)
                .distinct()
                .map(userRepository::findByUserId)
                .flatMap(Optional::stream)
                .forEach((user) -> displayNames.put(user.getUserId().toString(), buildDisplayName(user)));
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
        return UserMapper.toDTO(user, payoutFrequency);
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
            List<PayrollTaxTemplateDTO> payrollTaxTemplates
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

    public void deleteUser(UUID id, UUID companyId) {
        if (companyId != null) {
            User user = userRepository.findByUserIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new UserNotFoundException("User with id: " + id + " not found"));
            userRepository.deleteByUserId(user.getUserId());
            return;
        }
        if (!userRepository.existsById(id)) {
            throw new UserNotFoundException("User with id: " + id + " not found");
        }
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
        dto.setPayrollTaxTemplates(readPayrollTaxTemplates(company.getPayrollTaxTemplatesJson()));
        return dto;
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
}
