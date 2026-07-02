package com.pm.userservice.service.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class NotificationEventListenerTest {

    @Test
    void handleNotificationEventLogsOnlyEventMetadata(CapturedOutput output) {
        NotificationEventListener listener = new NotificationEventListener(new ObjectMapper());

        listener.handleNotificationEvent("""
                {"eventType":"USER_CREATED","userId":"user-123","email":"alex@example.com","temporaryPassword":"Temp123!"}
                """.getBytes(StandardCharsets.UTF_8));

        assertThat(output.getOut())
                .contains("Stub email delivery for notification event type=USER_CREATED userId=user-123")
                .doesNotContain("alex@example.com")
                .doesNotContain("Temp123!")
                .doesNotContain("\"email\"");
    }
}
