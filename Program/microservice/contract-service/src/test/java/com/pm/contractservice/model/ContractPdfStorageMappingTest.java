package com.pm.contractservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Lob;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContractPdfStorageMappingTest {

    @Test
    void pdfDataUsesPostgresByteaInsteadOfLargeObjectStorage() throws NoSuchFieldException {
        var pdfData = Contract.class.getDeclaredField("pdfData");

        assertThat(pdfData.getAnnotation(Lob.class)).isNull();
        assertThat(pdfData.getAnnotation(JdbcTypeCode.class))
                .extracting(JdbcTypeCode::value)
                .isEqualTo(SqlTypes.VARBINARY);
        assertThat(pdfData.getAnnotation(Column.class))
                .extracting(Column::columnDefinition)
                .isEqualTo("bytea");
    }
}
