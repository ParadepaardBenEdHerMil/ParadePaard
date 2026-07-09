package com.pm.userservice.validation;

import com.pm.userservice.exception.InvalidFileUploadException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * AP-3: the public job-application form is unauthenticated, so its file uploads are a
 * malware / huge-file vector. Only allowed document/image types within a size cap pass.
 */
class JobApplicationUploadValidatorTest {

    private static final long ONE_MB = 1024 * 1024;

    @Test
    void acceptsPdfCvWithinSizeLimit() {
        assertThatCode(() -> JobApplicationUploadValidator.validateCv("application/pdf", ONE_MB))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsWordCv() {
        assertThatCode(() -> JobApplicationUploadValidator.validateCv(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ONE_MB))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsExecutableDisguisedAsCv() {
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateCv("application/x-msdownload", ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class);
    }

    @Test
    void rejectsOversizeCv() {
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateCv("application/pdf", 6 * ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class)
                .hasMessageContaining("limit");
    }

    @Test
    void absentCvIsAllowed() {
        assertThatCode(() -> JobApplicationUploadValidator.validateCv(null, 0))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsPngProfilePicture() {
        assertThatCode(() -> JobApplicationUploadValidator.validateProfilePicture("image/png", ONE_MB))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsSvgProfilePicture_scriptXssVector() {
        // image/svg+xml can carry script; it must not be accepted as a profile picture.
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateProfilePicture("image/svg+xml", ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class);
    }

    @Test
    void rejectsOversizeProfilePicture() {
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateProfilePicture("image/jpeg", 6 * ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class);
    }

    @Test
    void contentTypeMatchIsCaseInsensitiveAndTrimmed() {
        assertThatCode(() -> JobApplicationUploadValidator.validateCv("  APPLICATION/PDF ", ONE_MB))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsNormalJpegIdDocumentImage() {
        // A typical phone photo of an ID (several MB) must pass — this is the reported regression.
        assertThatCode(() -> JobApplicationUploadValidator.validateIdDocumentImage("image/jpeg", 4 * ONE_MB))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsOversizeIdDocumentImage() {
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateIdDocumentImage("image/jpeg", 11 * ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class)
                .hasMessageContaining("limit");
    }

    @Test
    void rejectsNonImageIdDocument() {
        assertThatThrownBy(() -> JobApplicationUploadValidator.validateIdDocumentImage("application/pdf", ONE_MB))
                .isInstanceOf(InvalidFileUploadException.class);
    }
}
