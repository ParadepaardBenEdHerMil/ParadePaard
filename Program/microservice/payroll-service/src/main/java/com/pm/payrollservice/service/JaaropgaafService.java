package com.pm.payrollservice.service;

import com.pm.payrollservice.dto.CompanySettingsDTO;
import com.pm.payrollservice.dto.JaaropgaafDTO;
import com.pm.payrollservice.dto.PayrollDeductionLineDTO;
import com.pm.payrollservice.dto.PayslipDeductionCodec;
import com.pm.payrollservice.dto.VerzamelloonstaatDTO;
import com.pm.payrollservice.model.Jaaropgaaf;
import com.pm.payrollservice.model.JaaropgaafStatus;
import com.pm.payrollservice.model.Payslip;
import com.pm.payrollservice.model.PayslipStatus;
import com.pm.payrollservice.repository.JaaropgaafRepository;
import com.pm.payrollservice.repository.PayslipRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Builds the Dutch year-end statements by summing an employee's finalized
 * payslips for a calendar year (year = ISO week-based year). Totals are summed
 * across periods so they reconcile with the periodic loonaangiften. A jaaropgaaf
 * is PROVISIONAL until the employer finalizes the year, then it is snapshotted,
 * its PDF stored, and it becomes FINAL (locked).
 */
@Service
public class JaaropgaafService {
    private static final Logger log = LoggerFactory.getLogger(JaaropgaafService.class);

    private static final List<PayslipStatus> VISIBLE_STATUSES = List.of(
            PayslipStatus.RELEASED, PayslipStatus.APPROVED);

    private final PayslipRepository payslipRepository;
    private final JaaropgaafRepository jaaropgaafRepository;
    private final CompanySettingsClient companySettingsClient;
    private final PayslipPdfService pdfService;
    private final ObjectMapper objectMapper;

    public JaaropgaafService(PayslipRepository payslipRepository,
                             JaaropgaafRepository jaaropgaafRepository,
                             CompanySettingsClient companySettingsClient,
                             PayslipPdfService pdfService,
                             ObjectMapper objectMapper) {
        this.payslipRepository = payslipRepository;
        this.jaaropgaafRepository = jaaropgaafRepository;
        this.companySettingsClient = companySettingsClient;
        this.pdfService = pdfService;
        this.objectMapper = objectMapper;
    }

    public JaaropgaafDTO buildForEmployee(UUID companyId, UUID employeeId, int year, boolean includeBsn) {
        Optional<Jaaropgaaf> locked = loadFinal(companyId, employeeId, year);
        if (locked.isPresent()) {
            return snapshotToDto(locked.get(), includeBsn);
        }
        List<Payslip> payslips = finalizedPayslips(
                payslipRepository.findByUserIdAndWeekBasedYearOrderByDateOfIssueAsc(employeeId, year),
                companyId
        );
        return buildFromPayslips(employeeId, year, payslips, includeBsn, resolveEmployer(companyId));
    }

    public VerzamelloonstaatDTO buildVerzamelloonstaat(UUID companyId, int year) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required for a verzamelloonstaat");
        }
        List<Payslip> all = finalizedPayslips(
                payslipRepository.findByCompanyIdAndWeekBasedYearOrderByDateOfIssueAsc(companyId, year),
                companyId
        );

        Map<UUID, List<Payslip>> byEmployee = new LinkedHashMap<>();
        for (Payslip p : all) {
            byEmployee.computeIfAbsent(p.getUserId(), ignored -> new ArrayList<>()).add(p);
        }

        EmployerInfo employer = resolveEmployer(companyId);
        List<JaaropgaafDTO> rows = new ArrayList<>();
        for (Map.Entry<UUID, List<Payslip>> entry : byEmployee.entrySet()) {
            rows.add(buildFromPayslips(entry.getKey(), year, entry.getValue(), false, employer));
        }
        rows.sort(Comparator.comparing(r -> r.getEmployeeName() == null ? "" : r.getEmployeeName()));

        VerzamelloonstaatDTO dto = new VerzamelloonstaatDTO();
        dto.setYear(year);
        dto.setCompanyId(companyId.toString());
        dto.setEmployerName(employer.name());
        dto.setEmployeeCount(rows.size());
        dto.setEmployees(rows);
        dto.setTotalFiscalWage(sum(rows, JaaropgaafDTO::getFiscalWage));
        dto.setTotalLoonheffing(sum(rows, JaaropgaafDTO::getLoonheffing));
        dto.setTotalArbeidskortingApplied(sum(rows, JaaropgaafDTO::getArbeidskortingApplied));
        dto.setTotalEmployeeZvwWithheld(sum(rows, JaaropgaafDTO::getEmployeeZvwWithheld));
        dto.setTotalEmployerZvwLevy(sum(rows, JaaropgaafDTO::getEmployerZvwLevy));
        dto.setTotalEmployerInsurancePremiums(sum(rows, JaaropgaafDTO::getEmployerInsurancePremiums));
        dto.setTotalPensionEmployee(sum(rows, JaaropgaafDTO::getPensionEmployee));
        dto.setTotalGross(sum(rows, JaaropgaafDTO::getTotalGross));
        dto.setTotalNet(sum(rows, JaaropgaafDTO::getTotalNet));
        return dto;
    }

    /**
     * Finalizes (locks) every employee's jaaropgaaf for the year: snapshots the
     * figures, renders and stores the PDF, and marks it FINAL. Idempotent -
     * re-running overwrites the stored snapshot (a correction re-publish).
     */
    public int finalizeYear(UUID companyId, int year, UUID finalizedBy) {
        if (companyId == null) {
            throw new IllegalArgumentException("companyId is required to finalize jaaropgaven");
        }
        List<Payslip> all = finalizedPayslips(
                payslipRepository.findByCompanyIdAndWeekBasedYearOrderByDateOfIssueAsc(companyId, year),
                companyId
        );
        Map<UUID, List<Payslip>> byEmployee = new LinkedHashMap<>();
        for (Payslip p : all) {
            byEmployee.computeIfAbsent(p.getUserId(), ignored -> new ArrayList<>()).add(p);
        }

        EmployerInfo employer = resolveEmployer(companyId);
        int count = 0;
        for (Map.Entry<UUID, List<Payslip>> entry : byEmployee.entrySet()) {
            JaaropgaafDTO dto = buildFromPayslips(entry.getKey(), year, entry.getValue(), true, employer);
            dto.setStatus("FINAL");
            byte[] pdf = pdfService.generatePdfFromHtml(renderJaaropgaafHtml(dto));

            Jaaropgaaf entity = jaaropgaafRepository
                    .findByCompanyIdAndUserIdAndYear(companyId, entry.getKey(), year)
                    .orElseGet(Jaaropgaaf::new);
            entity.setCompanyId(companyId);
            entity.setUserId(entry.getKey());
            entity.setYear(year);
            entity.setStatus(JaaropgaafStatus.FINAL);
            entity.setFiscalWage(dto.getFiscalWage());
            entity.setLoonheffing(dto.getLoonheffing());
            entity.setTotalNet(dto.getTotalNet());
            entity.setSnapshotJson(writeSnapshot(dto));
            entity.setPdfData(pdf);
            entity.setFinalizedAt(OffsetDateTime.now());
            entity.setFinalizedByUserId(finalizedBy);
            jaaropgaafRepository.save(entity);
            count++;
        }
        return count;
    }

    private Optional<Jaaropgaaf> loadFinal(UUID companyId, UUID employeeId, int year) {
        if (companyId == null) {
            return Optional.empty();
        }
        return jaaropgaafRepository.findByCompanyIdAndUserIdAndYear(companyId, employeeId, year);
    }

    private JaaropgaafDTO snapshotToDto(Jaaropgaaf entity, boolean includeBsn) {
        JaaropgaafDTO dto;
        try {
            dto = objectMapper.readValue(entity.getSnapshotJson(), JaaropgaafDTO.class);
        } catch (Exception ex) {
            log.warn("Could not parse finalized jaaropgaaf snapshot {}", entity.getId(), ex);
            dto = new JaaropgaafDTO();
            dto.setYear(entity.getYear());
            dto.setUserId(entity.getUserId().toString());
            dto.setFiscalWage(entity.getFiscalWage());
            dto.setLoonheffing(entity.getLoonheffing());
            dto.setTotalNet(entity.getTotalNet());
        }
        dto.setStatus("FINAL");
        dto.setFinalizedAt(entity.getFinalizedAt() == null ? null : entity.getFinalizedAt().toString());
        if (!includeBsn) {
            maskBsn(dto);
        }
        return dto;
    }

    private void maskBsn(JaaropgaafDTO dto) {
        String bsn = dto.getBsn();
        if (bsn == null || bsn.isBlank() || dto.isBsnMasked()) {
            return;
        }
        String last = bsn.length() >= 4 ? bsn.substring(bsn.length() - 4) : bsn;
        dto.setBsn("*****" + last);
        dto.setBsnMasked(true);
    }

    private String writeSnapshot(JaaropgaafDTO dto) {
        try {
            return objectMapper.writeValueAsString(dto);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize jaaropgaaf snapshot", ex);
        }
    }

    private JaaropgaafDTO buildFromPayslips(
            UUID employeeId, int year, List<Payslip> payslips, boolean includeBsn, EmployerInfo employer) {
        EmployerInfo emp = employer == null ? EmployerInfo.EMPTY : employer;
        JaaropgaafDTO dto = new JaaropgaafDTO();
        dto.setYear(year);
        dto.setStatus("PROVISIONAL");
        dto.setUserId(employeeId.toString());
        dto.setEmployerName(emp.name());
        dto.setEmployerStreet(emp.street());
        dto.setEmployerPostalCode(emp.postalCode());
        dto.setEmployerCity(emp.city());

        BigDecimal fiscalWage = BigDecimal.ZERO;
        BigDecimal loonheffing = BigDecimal.ZERO;
        BigDecimal arbeidskorting = BigDecimal.ZERO;
        BigDecimal employeeZvw = BigDecimal.ZERO;
        BigDecimal employerZvw = BigDecimal.ZERO;
        BigDecimal employerPremiums = BigDecimal.ZERO;
        BigDecimal pensionEmployee = BigDecimal.ZERO;
        BigDecimal travel = BigDecimal.ZERO;
        BigDecimal hours = BigDecimal.ZERO;
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal net = BigDecimal.ZERO;
        boolean korting = false;
        String kortingFrom = null;

        for (Payslip p : payslips) {
            fiscalWage = fiscalWage.add(nz(p.getFiscalWage() != null ? p.getFiscalWage() : p.getTotalGrossAmount()));
            loonheffing = loonheffing.add(nz(p.getWageTaxWithheldTest()));
            arbeidskorting = arbeidskorting.add(nz(p.getArbeidskortingApplied()));
            employeeZvw = employeeZvw.add(nz(p.getEmployeeZvwWithheld()));
            employerZvw = employerZvw.add(nz(p.getEmployerZvwLevy()));
            employerPremiums = employerPremiums.add(nz(p.getEmployerInsurancePremiums()));
            pensionEmployee = pensionEmployee.add(sumPensionLines(p));
            travel = travel.add(nz(p.getTravelExpenses()));
            hours = hours.add(nz(p.getTotalHoursWorked()));
            gross = gross.add(nz(p.getTotalGrossAmount()));
            net = net.add(nz(p.getTotalNetAmount()));
            if (Boolean.TRUE.equals(p.getApplyLoonheffingskorting())) {
                korting = true;
                String issued = p.getDateOfIssue() == null ? null : p.getDateOfIssue().toString();
                if (issued != null && (kortingFrom == null || issued.compareTo(kortingFrom) < 0)) {
                    kortingFrom = issued;
                }
            }
        }

        Payslip latest = payslips.isEmpty() ? null : payslips.get(payslips.size() - 1);
        if (latest != null) {
            dto.setEmployeeName(latest.getName());
            dto.setDateOfBirth(latest.getDateOfBirth() == null ? null : latest.getDateOfBirth().toString());
            dto.setStreet(latest.getStreetName());
            dto.setHouseNumber(latest.getHouseNumber());
            dto.setHouseNumberSuffix(latest.getHouseNumberSuffix());
            dto.setPostalCode(latest.getPostalCode());
            dto.setCity(latest.getCity());
            dto.setCountry(latest.getCountry());
            dto.setHolidayAllowancePercentage(latest.getHolidayAllowancePercentage());
            applyBsn(dto, latest.getBsn(), includeBsn);
        }

        dto.setFiscalWage(money(fiscalWage));
        dto.setLoonheffing(money(loonheffing));
        dto.setArbeidskortingApplied(money(arbeidskorting));
        dto.setEmployeeZvwWithheld(money(employeeZvw));
        dto.setEmployerZvwLevy(money(employerZvw));
        dto.setEmployerInsurancePremiums(money(employerPremiums));
        dto.setPensionEmployee(money(pensionEmployee));
        dto.setTravelReimbursement(money(travel));
        dto.setHoursWorked(money(hours));
        dto.setTotalGross(money(gross));
        dto.setTotalNet(money(net));
        dto.setLoonheffingskortingApplied(korting);
        dto.setLoonheffingskortingFrom(kortingFrom);
        dto.setPayslipCount(payslips.size());
        return dto;
    }

    private void applyBsn(JaaropgaafDTO dto, String bsn, boolean includeBsn) {
        if (bsn == null || bsn.isBlank()) {
            dto.setBsn(null);
            dto.setBsnMasked(false);
            return;
        }
        if (includeBsn) {
            dto.setBsn(bsn);
            dto.setBsnMasked(false);
        } else {
            String last = bsn.length() >= 4 ? bsn.substring(bsn.length() - 4) : bsn;
            dto.setBsn("*****" + last);
            dto.setBsnMasked(true);
        }
    }

    private List<Payslip> finalizedPayslips(List<Payslip> payslips, UUID companyId) {
        List<Payslip> result = new ArrayList<>();
        for (Payslip p : payslips) {
            PayslipStatus status = p.getStatus() == null ? PayslipStatus.RELEASED : p.getStatus();
            if (!VISIBLE_STATUSES.contains(status)) {
                continue;
            }
            if (companyId != null && p.getCompanyId() != null && !companyId.equals(p.getCompanyId())) {
                continue;
            }
            result.add(p);
        }
        return result;
    }

    private BigDecimal sumPensionLines(Payslip payslip) {
        BigDecimal total = BigDecimal.ZERO;
        for (PayrollDeductionLineDTO line : PayslipDeductionCodec.read(payslip.getDeductionLinesJson())) {
            if ("PENSION".equalsIgnoreCase(line.getCategory())) {
                total = total.add(nz(line.getCalculatedAmount()));
            }
        }
        return total;
    }

    private EmployerInfo resolveEmployer(UUID companyId) {
        if (companyId == null) {
            return EmployerInfo.EMPTY;
        }
        try {
            CompanySettingsDTO settings = companySettingsClient.getCompanySettings(companyId.toString());
            if (settings == null) {
                return EmployerInfo.EMPTY;
            }
            return new EmployerInfo(
                    settings.getName(),
                    settings.getStreet(),
                    settings.getPostalCode(),
                    settings.getCity());
        } catch (Exception ex) {
            log.warn("Could not resolve employer info for company {}", companyId, ex);
            return EmployerInfo.EMPTY;
        }
    }

    /** Employer name + address block for the jaaropgaaf (legally required fields). */
    private record EmployerInfo(String name, String street, String postalCode, String city) {
        static final EmployerInfo EMPTY = new EmployerInfo(null, null, null, null);
    }

    private static BigDecimal sum(List<JaaropgaafDTO> rows, java.util.function.Function<JaaropgaafDTO, BigDecimal> field) {
        BigDecimal total = BigDecimal.ZERO;
        for (JaaropgaafDTO row : rows) {
            total = total.add(nz(field.apply(row)));
        }
        return money(total);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    // -----------------------------------------------------------------
    // PDF generation (reuses the FlyingSaucer payslip PDF stack)
    // -----------------------------------------------------------------
    public byte[] generateJaaropgaafPdf(UUID companyId, UUID employeeId, int year, boolean includeBsn) {
        Optional<Jaaropgaaf> locked = loadFinal(companyId, employeeId, year);
        if (locked.isPresent()) {
            if (includeBsn && locked.get().getPdfData() != null) {
                return locked.get().getPdfData();
            }
            return pdfService.generatePdfFromHtml(renderJaaropgaafHtml(snapshotToDto(locked.get(), includeBsn)));
        }
        return pdfService.generatePdfFromHtml(renderJaaropgaafHtml(buildForEmployee(companyId, employeeId, year, includeBsn)));
    }

    public byte[] generateVerzamelloonstaatPdf(UUID companyId, int year) {
        return pdfService.generatePdfFromHtml(renderVerzamelloonstaatHtml(buildVerzamelloonstaat(companyId, year)));
    }

    private String renderJaaropgaafHtml(JaaropgaafDTO d) {
        boolean provisional = !"FINAL".equalsIgnoreCase(d.getStatus());
        NumberFormat eur = eur();
        StringBuilder address = new StringBuilder();
        address.append(escape(orEmpty(d.getStreet()))).append(' ').append(escape(orEmpty(d.getHouseNumber())));
        if (orEmpty(d.getHouseNumberSuffix()).length() > 0) address.append(escape(d.getHouseNumberSuffix()));
        String cityLine = (orEmpty(d.getPostalCode()) + " " + orEmpty(d.getCity())).trim();

        StringBuilder b = new StringBuilder();
        b.append("<html><head><meta charset=\"utf-8\"/><style>")
                .append("body{font-family:sans-serif;font-size:11px;color:#111;}")
                .append("h1{font-size:18px;margin:0 0 2px 0;} h2{font-size:13px;margin:14px 0 4px 0;}")
                .append(".muted{color:#555;} .box{border:1px solid #ccc;padding:8px;margin-bottom:10px;}")
                .append(".banner{border:1px solid #d9a300;background:#fff7e0;color:#8a6d00;padding:6px 8px;margin-bottom:10px;font-weight:bold;}")
                .append("table{width:100%;border-collapse:collapse;} td{padding:3px 4px;vertical-align:top;}")
                .append(".num{text-align:right;} .tot td{border-top:1px solid #333;font-weight:bold;}")
                .append("</style></head><body>");
        b.append("<h1>Jaaropgaaf ").append(d.getYear()).append("</h1>");
        if (provisional) {
            b.append("<div class=\"banner\">VOORLOPIG / CONCEPT - het jaar is nog niet afgerond; de bedragen kunnen nog wijzigen.</div>");
        } else {
            b.append("<div class=\"muted\">Officiele jaaropgaaf voor de aangifte inkomstenbelasting.</div>");
        }

        b.append("<h2>Werkgever</h2><div class=\"box\">").append(escape(orEmpty(d.getEmployerName())));
        if (orEmpty(d.getEmployerStreet()).length() > 0) {
            b.append("<br/>").append(escape(d.getEmployerStreet()));
            b.append("<br/>").append(escape((orEmpty(d.getEmployerPostalCode()) + " " + orEmpty(d.getEmployerCity())).trim()));
        }
        b.append("</div>");

        b.append("<h2>Werknemer</h2><div class=\"box\">")
                .append(escape(orEmpty(d.getEmployeeName()))).append("<br/>")
                .append(address).append("<br/>").append(escape(cityLine)).append("<br/>")
                .append("Geboortedatum: ").append(escape(orEmpty(d.getDateOfBirth()))).append("<br/>")
                .append("BSN: ").append(escape(orEmpty(d.getBsn()))).append(d.isBsnMasked() ? " <span class=\"muted\">(afgeschermd)</span>" : "")
                .append("</div>");

        b.append("<h2>Fiscaal jaaroverzicht</h2><table>");
        b.append(row("Fiscaal loon (loon voor de loonheffing)", eur.format(safe(d.getFiscalWage()))));
        b.append(row("Ingehouden loonheffing", eur.format(safe(d.getLoonheffing()))));
        b.append(row("Verrekende arbeidskorting", eur.format(safe(d.getArbeidskortingApplied()))));
        b.append(row("Ingehouden bijdrage Zvw", eur.format(safe(d.getEmployeeZvwWithheld()))));
        b.append(row("Werkgeversheffing Zvw", eur.format(safe(d.getEmployerZvwLevy()))));
        b.append(row("Premies werknemersverzekeringen (werkgever)", eur.format(safe(d.getEmployerInsurancePremiums()))));
        b.append(row("Werknemersdeel pensioenpremie", eur.format(safe(d.getPensionEmployee()))));
        b.append(row("Loonheffingskorting toegepast", d.isLoonheffingskortingApplied()
                ? ("Ja" + (d.getLoonheffingskortingFrom() != null ? " (vanaf " + escape(d.getLoonheffingskortingFrom()) + ")" : ""))
                : "Nee"));
        b.append(row("Reiskostenvergoeding", eur.format(safe(d.getTravelReimbursement()))));
        b.append(row("Gewerkte uren", safe(d.getHoursWorked()).toPlainString()));
        b.append("<tr class=\"tot\"><td>Totaal bruto / netto</td><td class=\"num\">")
                .append(eur.format(safe(d.getTotalGross()))).append(" / ").append(eur.format(safe(d.getTotalNet())))
                .append("</td></tr>");
        b.append("</table>");
        b.append("<p class=\"muted\">Samengesteld uit ").append(d.getPayslipCount())
                .append(" loonstroken in ").append(d.getYear())
                .append(". Bewaar dit document ten minste 7 jaar.</p>");
        b.append("</body></html>");
        return b.toString();
    }

    private String renderVerzamelloonstaatHtml(VerzamelloonstaatDTO d) {
        NumberFormat eur = eur();
        StringBuilder b = new StringBuilder();
        b.append("<html><head><meta charset=\"utf-8\"/><style>")
                .append("body{font-family:sans-serif;font-size:10px;color:#111;}")
                .append("h1{font-size:18px;margin:0 0 2px 0;}")
                .append("table{width:100%;border-collapse:collapse;margin-top:8px;}")
                .append("th,td{padding:3px 4px;border-bottom:1px solid #ddd;} th{background:#f2f2f2;text-align:left;}")
                .append(".num{text-align:right;} .tot td{border-top:2px solid #333;font-weight:bold;}")
                .append("</style></head><body>");
        b.append("<h1>Verzamelloonstaat ").append(d.getYear()).append("</h1>");
        b.append("<div>").append(escape(orEmpty(d.getEmployerName()))).append(" - ")
                .append(d.getEmployeeCount()).append(" werknemers</div>");
        b.append("<table><tr><th>Werknemer</th><th class=\"num\">Fiscaal loon</th><th class=\"num\">Loonheffing</th>")
                .append("<th class=\"num\">Arbeidskorting</th><th class=\"num\">Bijdrage Zvw</th>")
                .append("<th class=\"num\">Wg. Zvw</th><th class=\"num\">Premies wnv</th><th class=\"num\">Netto</th></tr>");
        for (JaaropgaafDTO r : d.getEmployees() == null ? List.<JaaropgaafDTO>of() : d.getEmployees()) {
            b.append("<tr><td>").append(escape(orEmpty(r.getEmployeeName()))).append("</td>")
                    .append(numCell(eur, r.getFiscalWage())).append(numCell(eur, r.getLoonheffing()))
                    .append(numCell(eur, r.getArbeidskortingApplied())).append(numCell(eur, r.getEmployeeZvwWithheld()))
                    .append(numCell(eur, r.getEmployerZvwLevy())).append(numCell(eur, r.getEmployerInsurancePremiums()))
                    .append(numCell(eur, r.getTotalNet())).append("</tr>");
        }
        b.append("<tr class=\"tot\"><td>Totaal</td>")
                .append(numCell(eur, d.getTotalFiscalWage())).append(numCell(eur, d.getTotalLoonheffing()))
                .append(numCell(eur, d.getTotalArbeidskortingApplied())).append(numCell(eur, d.getTotalEmployeeZvwWithheld()))
                .append(numCell(eur, d.getTotalEmployerZvwLevy())).append(numCell(eur, d.getTotalEmployerInsurancePremiums()))
                .append(numCell(eur, d.getTotalNet())).append("</tr>");
        b.append("</table></body></html>");
        return b.toString();
    }

    private static String row(String label, String value) {
        return "<tr><td>" + escape(label) + "</td><td class=\"num\">" + value + "</td></tr>";
    }

    private static String numCell(NumberFormat eur, BigDecimal value) {
        return "<td class=\"num\">" + eur.format(safe(value)) + "</td>";
    }

    private static NumberFormat eur() {
        return NumberFormat.getCurrencyInstance(new Locale("nl", "NL"));
    }

    private static BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
