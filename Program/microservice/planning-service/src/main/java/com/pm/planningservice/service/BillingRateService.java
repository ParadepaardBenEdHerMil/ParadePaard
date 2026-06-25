package com.pm.planningservice.service;

import com.pm.planningservice.dto.BillingRateDTO;
import com.pm.planningservice.dto.BillingRateSaveRequestDTO;
import com.pm.planningservice.dto.ClientBillingRatesDTO;
import com.pm.planningservice.dto.UserBillingRatesDTO;
import com.pm.planningservice.model.ClientCompany;
import com.pm.planningservice.model.ClientFunctionBillingRate;
import com.pm.planningservice.model.EmployeeClientFunctionBillingRate;
import com.pm.planningservice.model.EmployeeProjectFunctionBillingRate;
import com.pm.planningservice.model.Project;
import com.pm.planningservice.model.ProjectFunctionBillingRate;
import com.pm.planningservice.repository.ClientCompanyRepository;
import com.pm.planningservice.repository.ClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeClientFunctionBillingRateRepository;
import com.pm.planningservice.repository.EmployeeProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectFunctionBillingRateRepository;
import com.pm.planningservice.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class BillingRateService {
    private final ClientCompanyRepository clientCompanyRepository;
    private final ProjectRepository projectRepository;
    private final ClientFunctionBillingRateRepository clientFunctionBillingRateRepository;
    private final ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository;
    private final EmployeeClientFunctionBillingRateRepository employeeClientFunctionBillingRateRepository;
    private final EmployeeProjectFunctionBillingRateRepository employeeProjectFunctionBillingRateRepository;

    public BillingRateService(
            ClientCompanyRepository clientCompanyRepository,
            ProjectRepository projectRepository,
            ClientFunctionBillingRateRepository clientFunctionBillingRateRepository,
            ProjectFunctionBillingRateRepository projectFunctionBillingRateRepository,
            EmployeeClientFunctionBillingRateRepository employeeClientFunctionBillingRateRepository,
            EmployeeProjectFunctionBillingRateRepository employeeProjectFunctionBillingRateRepository
    ) {
        this.clientCompanyRepository = clientCompanyRepository;
        this.projectRepository = projectRepository;
        this.clientFunctionBillingRateRepository = clientFunctionBillingRateRepository;
        this.projectFunctionBillingRateRepository = projectFunctionBillingRateRepository;
        this.employeeClientFunctionBillingRateRepository = employeeClientFunctionBillingRateRepository;
        this.employeeProjectFunctionBillingRateRepository = employeeProjectFunctionBillingRateRepository;
    }

    @Transactional(readOnly = true)
    public ClientBillingRatesDTO listClientBillingRates(UUID companyId, UUID clientCompanyId) {
        ClientCompany client = requireClient(companyId, clientCompanyId);
        Map<UUID, Project> projectsById = projectRepository.findByCompanyIdOrderByStartDateAsc(companyId).stream()
                .filter(project -> clientCompanyId.equals(project.getClientCompanyId()))
                .collect(Collectors.toMap(Project::getProjectId, Function.identity()));

        ClientBillingRatesDTO response = new ClientBillingRatesDTO();
        response.setDefaultRates(clientFunctionBillingRateRepository
                .findByCompanyIdAndClientCompanyIdOrderByFunctionNameAscEffectiveFromDesc(companyId, clientCompanyId)
                .stream()
                .map(rate -> toDto(rate, client.getName()))
                .toList());
        response.setProjectRates(projectFunctionBillingRateRepository
                .findByCompanyIdAndClientCompanyIdOrderByProjectIdAscFunctionNameAsc(companyId, clientCompanyId)
                .stream()
                .map(rate -> toDto(rate, client.getName(), projectsById.get(rate.getProjectId())))
                .toList());
        response.setEmployeeOverrides(employeeClientFunctionBillingRateRepository
                .findByCompanyIdAndClientCompanyIdOrderByFunctionNameAsc(companyId, clientCompanyId)
                .stream()
                .map(rate -> toDto(rate, client.getName()))
                .toList());
        response.setProjectEmployeeOverrides(employeeProjectFunctionBillingRateRepository
                .findByCompanyIdAndClientCompanyIdOrderByProjectIdAscFunctionNameAsc(companyId, clientCompanyId)
                .stream()
                .map(rate -> toDto(rate, client.getName(), projectsById.get(rate.getProjectId())))
                .toList());
        return response;
    }

    @Transactional(readOnly = true)
    public UserBillingRatesDTO listUserBillingRates(UUID companyId, UUID userId) {
        UserBillingRatesDTO response = new UserBillingRatesDTO();
        response.setUserId(userId);
        response.setClientOverrides(employeeClientFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByFunctionNameAsc(companyId, userId)
                .stream()
                .map(rate -> toDto(rate, clientName(companyId, rate.getClientCompanyId())))
                .toList());
        response.setProjectOverrides(employeeProjectFunctionBillingRateRepository
                .findByCompanyIdAndUserIdOrderByProjectIdAscFunctionNameAsc(companyId, userId)
                .stream()
                .map(rate -> toDto(rate, clientName(companyId, rate.getClientCompanyId()), project(companyId, rate.getProjectId())))
                .toList());
        return response;
    }

    @Transactional
    public BillingRateDTO saveClientDefaultRate(
            UUID companyId,
            UUID userId,
            UUID clientCompanyId,
            BillingRateSaveRequestDTO request
    ) {
        ClientCompany client = requireClient(companyId, clientCompanyId);
        String functionName = normalizeFunctionName(request.getFunctionName());
        BigDecimal ratePerHour = requirePositiveRate(request.getRatePerHour());
        LocalDateTime effectiveFrom = request.getEffectiveFrom() == null ? LocalDateTime.now() : request.getEffectiveFrom();

        clientFunctionBillingRateRepository
                .findFirstByCompanyIdAndClientCompanyIdAndFunctionNameIgnoreCaseAndActiveTrue(
                        companyId,
                        clientCompanyId,
                        functionName
                )
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setEffectiveTo(effectiveFrom);
                    existing.setUpdatedByUserId(userId);
                    clientFunctionBillingRateRepository.save(existing);
                });

        ClientFunctionBillingRate next = new ClientFunctionBillingRate();
        next.setCompanyId(companyId);
        next.setClientCompanyId(clientCompanyId);
        next.setFunctionName(functionName);
        next.setRatePerHour(ratePerHour);
        next.setEffectiveFrom(effectiveFrom);
        next.setEffectiveTo(request.getEffectiveTo());
        next.setActive(true);
        next.setNotes(normalizeOptionalText(request.getNotes()));
        next.setCreatedByUserId(userId);
        next.setUpdatedByUserId(userId);
        return toDto(clientFunctionBillingRateRepository.save(next), client.getName());
    }

    @Transactional
    public BillingRateDTO saveProjectRate(UUID companyId, UUID userId, UUID clientCompanyId, BillingRateSaveRequestDTO request) {
        requireClient(companyId, clientCompanyId);
        Project project = requireProject(companyId, request.getProjectId());
        if (!clientCompanyId.equals(project.getClientCompanyId())) {
            throw new IllegalArgumentException("Project does not belong to this client");
        }
        String functionName = normalizeFunctionName(request.getFunctionName());
        BigDecimal ratePerHour = requirePositiveRate(request.getRatePerHour());
        LocalDateTime effectiveFrom = request.getEffectiveFrom() == null ? LocalDateTime.now() : request.getEffectiveFrom();

        // Version on change so historical margin survives rate edits: end the
        // current active rate and insert a new active one (matches client rates).
        projectFunctionBillingRateRepository
                .findFirstByCompanyIdAndProjectIdAndFunctionNameIgnoreCaseAndActiveTrue(companyId, project.getProjectId(), functionName)
                .ifPresent(existing -> {
                    existing.setActive(false);
                    existing.setEffectiveTo(effectiveFrom);
                    existing.setUpdatedByUserId(userId);
                    projectFunctionBillingRateRepository.save(existing);
                });

        ProjectFunctionBillingRate rate = new ProjectFunctionBillingRate();
        rate.setCompanyId(companyId);
        rate.setClientCompanyId(clientCompanyId);
        rate.setProjectId(project.getProjectId());
        rate.setFunctionName(functionName);
        rate.setRatePerHour(ratePerHour);
        rate.setEffectiveFrom(effectiveFrom);
        rate.setEffectiveTo(request.getEffectiveTo());
        rate.setActive(true);
        rate.setNotes(normalizeOptionalText(request.getNotes()));
        rate.setCreatedByUserId(userId);
        rate.setUpdatedByUserId(userId);
        return toDto(projectFunctionBillingRateRepository.save(rate), clientName(companyId, clientCompanyId), project);
    }

    @Transactional
    public BillingRateDTO saveClientEmployeeOverride(
            UUID companyId,
            UUID userId,
            UUID clientCompanyId,
            BillingRateSaveRequestDTO request
    ) {
        ClientCompany client = requireClient(companyId, clientCompanyId);
        UUID employeeId = requireUserId(request.getUserId());
        String functionName = normalizeFunctionName(request.getFunctionName());
        EmployeeClientFunctionBillingRate rate = employeeClientFunctionBillingRateRepository
                .findFirstByCompanyIdAndClientCompanyIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue(
                        companyId,
                        clientCompanyId,
                        employeeId,
                        functionName
                )
                .orElseGet(EmployeeClientFunctionBillingRate::new);
        rate.setCompanyId(companyId);
        rate.setClientCompanyId(clientCompanyId);
        rate.setUserId(employeeId);
        rate.setFunctionName(functionName);
        rate.setRatePerHour(requirePositiveRate(request.getRatePerHour()));
        rate.setEffectiveFrom(request.getEffectiveFrom());
        rate.setEffectiveTo(request.getEffectiveTo());
        rate.setActive(true);
        rate.setNotes(normalizeOptionalText(request.getNotes()));
        rate.setUpdatedByUserId(userId);
        if (rate.getCreatedByUserId() == null) {
            rate.setCreatedByUserId(userId);
        }
        return toDto(employeeClientFunctionBillingRateRepository.save(rate), client.getName());
    }

    @Transactional
    public BillingRateDTO saveProjectEmployeeOverride(
            UUID companyId,
            UUID userId,
            UUID clientCompanyId,
            BillingRateSaveRequestDTO request
    ) {
        requireClient(companyId, clientCompanyId);
        Project project = requireProject(companyId, request.getProjectId());
        if (!clientCompanyId.equals(project.getClientCompanyId())) {
            throw new IllegalArgumentException("Project does not belong to this client");
        }
        UUID employeeId = requireUserId(request.getUserId());
        String functionName = normalizeFunctionName(request.getFunctionName());
        EmployeeProjectFunctionBillingRate rate = employeeProjectFunctionBillingRateRepository
                .findFirstByCompanyIdAndProjectIdAndUserIdAndFunctionNameIgnoreCaseAndActiveTrue(
                        companyId,
                        project.getProjectId(),
                        employeeId,
                        functionName
                )
                .orElseGet(EmployeeProjectFunctionBillingRate::new);
        rate.setCompanyId(companyId);
        rate.setClientCompanyId(clientCompanyId);
        rate.setProjectId(project.getProjectId());
        rate.setUserId(employeeId);
        rate.setFunctionName(functionName);
        rate.setRatePerHour(requirePositiveRate(request.getRatePerHour()));
        rate.setEffectiveFrom(request.getEffectiveFrom());
        rate.setEffectiveTo(request.getEffectiveTo());
        rate.setActive(true);
        rate.setNotes(normalizeOptionalText(request.getNotes()));
        rate.setUpdatedByUserId(userId);
        if (rate.getCreatedByUserId() == null) {
            rate.setCreatedByUserId(userId);
        }
        return toDto(employeeProjectFunctionBillingRateRepository.save(rate), clientName(companyId, clientCompanyId), project);
    }

    @Transactional
    public void deleteBillingRate(UUID companyId, UUID clientCompanyId, String scope, UUID rateId) {
        if (rateId == null) {
            throw new IllegalArgumentException("Billing rate is required");
        }

        switch (scope) {
            case "CLIENT_FUNCTION" -> {
                ClientFunctionBillingRate rate = clientFunctionBillingRateRepository.findById(rateId)
                        .orElseThrow(() -> new IllegalArgumentException("Billing rate not found"));
                requireBillingRateOwnership(companyId, clientCompanyId, rate.getCompanyId(), rate.getClientCompanyId());
                clientFunctionBillingRateRepository.delete(rate);
            }
            case "PROJECT_FUNCTION" -> {
                ProjectFunctionBillingRate rate = projectFunctionBillingRateRepository.findById(rateId)
                        .orElseThrow(() -> new IllegalArgumentException("Billing rate not found"));
                requireBillingRateOwnership(companyId, clientCompanyId, rate.getCompanyId(), rate.getClientCompanyId());
                projectFunctionBillingRateRepository.delete(rate);
            }
            case "CLIENT_EMPLOYEE_FUNCTION" -> {
                EmployeeClientFunctionBillingRate rate = employeeClientFunctionBillingRateRepository.findById(rateId)
                        .orElseThrow(() -> new IllegalArgumentException("Billing rate not found"));
                requireBillingRateOwnership(companyId, clientCompanyId, rate.getCompanyId(), rate.getClientCompanyId());
                employeeClientFunctionBillingRateRepository.delete(rate);
            }
            case "PROJECT_EMPLOYEE_FUNCTION" -> {
                EmployeeProjectFunctionBillingRate rate = employeeProjectFunctionBillingRateRepository.findById(rateId)
                        .orElseThrow(() -> new IllegalArgumentException("Billing rate not found"));
                requireBillingRateOwnership(companyId, clientCompanyId, rate.getCompanyId(), rate.getClientCompanyId());
                employeeProjectFunctionBillingRateRepository.delete(rate);
            }
            default -> throw new IllegalArgumentException("Unsupported billing rate scope");
        }
    }

    private BillingRateDTO toDto(ClientFunctionBillingRate rate, String clientName) {
        BillingRateDTO dto = baseDto("CLIENT_FUNCTION", rate.getClientCompanyId(), clientName, rate.getFunctionName(), rate.getRatePerHour());
        dto.setId(rate.getClientFunctionBillingRateId());
        dto.setEffectiveFrom(rate.getEffectiveFrom());
        dto.setEffectiveTo(rate.getEffectiveTo());
        dto.setActive(rate.getActive());
        dto.setNotes(rate.getNotes());
        dto.setCreatedAt(rate.getCreatedAt());
        dto.setUpdatedAt(rate.getUpdatedAt());
        return dto;
    }

    private BillingRateDTO toDto(ProjectFunctionBillingRate rate, String clientName, Project project) {
        BillingRateDTO dto = baseDto("PROJECT_FUNCTION", rate.getClientCompanyId(), clientName, rate.getFunctionName(), rate.getRatePerHour());
        dto.setId(rate.getProjectFunctionBillingRateId());
        dto.setProjectId(rate.getProjectId());
        dto.setProjectName(project == null ? null : project.getName());
        dto.setEffectiveFrom(rate.getEffectiveFrom());
        dto.setEffectiveTo(rate.getEffectiveTo());
        dto.setActive(rate.getActive());
        dto.setSourceClientFunctionBillingRateId(rate.getSourceClientFunctionBillingRateId());
        dto.setNotes(rate.getNotes());
        dto.setCreatedAt(rate.getCreatedAt());
        dto.setUpdatedAt(rate.getUpdatedAt());
        return dto;
    }

    private BillingRateDTO toDto(EmployeeClientFunctionBillingRate rate, String clientName) {
        BillingRateDTO dto = baseDto("CLIENT_EMPLOYEE_FUNCTION", rate.getClientCompanyId(), clientName, rate.getFunctionName(), rate.getRatePerHour());
        dto.setId(rate.getEmployeeClientFunctionBillingRateId());
        dto.setUserId(rate.getUserId());
        dto.setEffectiveFrom(rate.getEffectiveFrom());
        dto.setEffectiveTo(rate.getEffectiveTo());
        dto.setActive(rate.getActive());
        dto.setNotes(rate.getNotes());
        dto.setCreatedAt(rate.getCreatedAt());
        dto.setUpdatedAt(rate.getUpdatedAt());
        return dto;
    }

    private BillingRateDTO toDto(EmployeeProjectFunctionBillingRate rate, String clientName, Project project) {
        BillingRateDTO dto = baseDto("PROJECT_EMPLOYEE_FUNCTION", rate.getClientCompanyId(), clientName, rate.getFunctionName(), rate.getRatePerHour());
        dto.setId(rate.getEmployeeProjectFunctionBillingRateId());
        dto.setProjectId(rate.getProjectId());
        dto.setProjectName(project == null ? null : project.getName());
        dto.setUserId(rate.getUserId());
        dto.setEffectiveFrom(rate.getEffectiveFrom());
        dto.setEffectiveTo(rate.getEffectiveTo());
        dto.setActive(rate.getActive());
        dto.setNotes(rate.getNotes());
        dto.setCreatedAt(rate.getCreatedAt());
        dto.setUpdatedAt(rate.getUpdatedAt());
        return dto;
    }

    private BillingRateDTO baseDto(String scope, UUID clientCompanyId, String clientName, String functionName, BigDecimal ratePerHour) {
        BillingRateDTO dto = new BillingRateDTO();
        dto.setScope(scope);
        dto.setClientCompanyId(clientCompanyId);
        dto.setClientName(clientName);
        dto.setFunctionName(functionName);
        dto.setRatePerHour(ratePerHour);
        return dto;
    }

    private ClientCompany requireClient(UUID companyId, UUID clientCompanyId) {
        if (clientCompanyId == null) {
            throw new IllegalArgumentException("Client company is required");
        }
        return clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Client company not found"));
    }

    private Project requireProject(UUID companyId, UUID projectId) {
        if (projectId == null) {
            throw new IllegalArgumentException("Project is required");
        }
        return projectRepository.findByProjectIdAndCompanyId(projectId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private Project project(UUID companyId, UUID projectId) {
        return projectId == null ? null : projectRepository.findByProjectIdAndCompanyId(projectId, companyId).orElse(null);
    }

    private String clientName(UUID companyId, UUID clientCompanyId) {
        return clientCompanyId == null
                ? null
                : clientCompanyRepository.findByClientCompanyIdAndOwnerCompanyId(clientCompanyId, companyId)
                .map(ClientCompany::getName)
                .orElse(null);
    }

    private String normalizeFunctionName(String value) {
        String normalized = normalizeOptionalText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Function name is required");
        }
        return normalized;
    }

    private BigDecimal requirePositiveRate(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Rate per hour must be greater than zero");
        }
        return value;
    }

    private UUID requireUserId(UUID value) {
        if (value == null) {
            throw new IllegalArgumentException("Employee is required");
        }
        return value;
    }

    private void requireBillingRateOwnership(UUID companyId, UUID clientCompanyId, UUID rateCompanyId, UUID rateClientCompanyId) {
        if (!companyId.equals(rateCompanyId) || !clientCompanyId.equals(rateClientCompanyId)) {
            throw new IllegalArgumentException("Billing rate not found");
        }
    }

    private String normalizeOptionalText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
