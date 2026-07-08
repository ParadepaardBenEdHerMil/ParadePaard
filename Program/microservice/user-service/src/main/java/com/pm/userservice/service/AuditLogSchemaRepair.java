package com.pm.userservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * In long-lived deployments the audit_log_entries table predates Flyway, and its unbounded
 * text columns (summary, message_parts_json) were originally created by Hibernate as BYTEA
 * (the old String-on-Postgres LOB mapping). Inserting a String into a BYTEA column fails at
 * runtime with an HTTP 500 even though the application starts cleanly, because schema
 * validation does not reject the type mismatch. On startup we normalise every such column
 * back to TEXT so audit writes succeed. Repairing only `summary` (as before) still left
 * `message_parts_json` — written on every audit entry — broken, which failed every insert.
 */
@Component
public class AuditLogSchemaRepair implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(AuditLogSchemaRepair.class);

    // Every unbounded text column on audit_log_entries. Names are a fixed whitelist (never
    // user input), so inlining them into DDL below is injection-safe.
    private static final String[] TEXT_COLUMNS = {"summary", "message_parts_json"};

    private final JdbcTemplate jdbcTemplate;

    public AuditLogSchemaRepair(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        repairTextColumns();
    }

    void repairTextColumns() {
        for (String column : TEXT_COLUMNS) {
            repairTextColumn(column);
        }
    }

    private void repairTextColumn(String column) {
        String columnType = jdbcTemplate.query(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_name = 'audit_log_entries' AND column_name = '" + column + "'",
                resultSet -> resultSet.next() ? resultSet.getString(1) : null
        );

        if (columnType == null) {
            return;
        }
        if ("bytea".equalsIgnoreCase(columnType)) {
            LOGGER.warn("Repairing audit_log_entries.{} from BYTEA to TEXT", column);
            jdbcTemplate.execute(
                    "ALTER TABLE audit_log_entries ALTER COLUMN " + column
                            + " TYPE TEXT USING convert_from(" + column + ", 'UTF8')");
            return;
        }
        if ("character varying".equalsIgnoreCase(columnType)) {
            jdbcTemplate.execute("ALTER TABLE audit_log_entries ALTER COLUMN " + column + " TYPE TEXT");
        }
    }
}
