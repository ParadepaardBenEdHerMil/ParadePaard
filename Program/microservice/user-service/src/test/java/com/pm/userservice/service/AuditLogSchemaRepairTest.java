package com.pm.userservice.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditLogSchemaRepairTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void repairConvertsLegacyByteaColumns() {
        when(jdbcTemplate.query(any(String.class), any(ResultSetExtractor.class))).thenReturn("bytea");

        AuditLogSchemaRepair repair = new AuditLogSchemaRepair(jdbcTemplate);
        repair.repairTextColumns();

        // Both unbounded text columns must be normalised, not just summary — leaving
        // message_parts_json as BYTEA fails every audit insert with a 500.
        verify(jdbcTemplate).execute(eq(
                "ALTER TABLE audit_log_entries ALTER COLUMN summary TYPE TEXT USING convert_from(summary, 'UTF8')"
        ));
        verify(jdbcTemplate).execute(eq(
                "ALTER TABLE audit_log_entries ALTER COLUMN message_parts_json TYPE TEXT USING convert_from(message_parts_json, 'UTF8')"
        ));
    }

    @Test
    void repairLeavesTextColumnsAlone() {
        when(jdbcTemplate.query(any(String.class), any(ResultSetExtractor.class))).thenReturn("text");

        AuditLogSchemaRepair repair = new AuditLogSchemaRepair(jdbcTemplate);
        repair.repairTextColumns();

        verify(jdbcTemplate, never()).execute(any(String.class));
    }
}
