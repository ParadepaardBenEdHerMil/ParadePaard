package com.pm.userservice.service;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Resolves {@code {{...}}} placeholders in preset email content at send time:
 *
 *  - Link placeholders ({@code {{reset_password_url}}}, {@code {{login_url}}}, …) become absolute
 *    URLs against the configured frontend base URL, so a preset authored anywhere works in every
 *    environment.
 *  - Personalization placeholders ({@code {{first_name}}}, {@code {{full_name}}}) become the
 *    recipient's name (HTML-escaped, since content is HTML). Unknown recipients get an empty string.
 *
 * The link catalogue is mirrored by the frontend's Insert menu; keep the two in sync.
 */
@Component
public class MergeFieldResolver {

    /** Placeholder key -> path appended to the frontend base URL. */
    private static final Map<String, String> LINK_PATHS = new LinkedHashMap<>();

    static {
        LINK_PATHS.put("app_url", "");
        LINK_PATHS.put("home_url", "/");
        LINK_PATHS.put("login_url", "/login");
        LINK_PATHS.put("reset_password_url", "/forgot-password");
        LINK_PATHS.put("apply_url", "/apply");
        LINK_PATHS.put("planning_url", "/my-planning");
        LINK_PATHS.put("account_url", "/account");
        LINK_PATHS.put("employment_url", "/account/employment");
        LINK_PATHS.put("payslips_url", "/payslips");
        LINK_PATHS.put("messages_url", "/messages");
    }

    private final String baseUrl;

    public MergeFieldResolver(
            @Value("${app.frontend.base-url:http://localhost:5173}") String baseUrl) {
        this.baseUrl = stripTrailingSlash(baseUrl);
    }

    /** Resolves placeholders in an HTML body; personalization values are HTML-escaped. */
    public String resolveHtml(String content, String firstName, String fullName) {
        return resolve(content, firstName, fullName, true);
    }

    /** Resolves placeholders in a plain-text subject; personalization values are not escaped. */
    public String resolveSubject(String content, String firstName, String fullName) {
        return resolve(content, firstName, fullName, false);
    }

    private String resolve(String content, String firstName, String fullName, boolean escape) {
        if (content == null || content.isEmpty()) {
            return content;
        }
        String resolved = content;
        for (Map.Entry<String, String> entry : LINK_PATHS.entrySet()) {
            resolved = resolved.replace("{{" + entry.getKey() + "}}", baseUrl + entry.getValue());
        }
        String first = StringUtils.trimToEmpty(firstName);
        String full = StringUtils.trimToEmpty(fullName);
        resolved = resolved.replace("{{first_name}}", escape ? escapeHtml(first) : first);
        resolved = resolved.replace("{{full_name}}", escape ? escapeHtml(full) : full);
        return resolved;
    }

    private static String stripTrailingSlash(String value) {
        String trimmed = StringUtils.trimToEmpty(value);
        return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
