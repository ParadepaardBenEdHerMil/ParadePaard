package com.pm.userservice;

import com.pm.userservice.config.SecurityConfig;
import com.pm.userservice.controller.MessageController;
import com.pm.userservice.dto.MessageConversationDTO;
import com.pm.userservice.service.MessageService;
import com.pm.userservice.service.MessageSseService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MessageController.class)
@Import(SecurityConfig.class)
class MessageControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MessageService messageService;

    @MockitoBean
    private MessageSseService messageSseService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @Test
    void anonymousGetMyConversationIsUnauthorized() throws Exception {
        mockMvc.perform(get("/messages/me"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(messageService, messageSseService);
    }

    @Test
    void getMyConversationWithAuthenticationReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        MessageConversationDTO conversation = new MessageConversationDTO();
        conversation.setConversationId(UUID.randomUUID().toString());
        when(messageService.getMyConversation(userId)).thenReturn(conversation);

        mockMvc.perform(get("/messages/me")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").value(conversation.getConversationId()));
    }

    @Test
    void listAdminConversationsWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(get("/messages/admin/conversations")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(messageService, messageSseService);
    }

    @Test
    void listAdminConversationsWithManagePermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, List.of("CAN_MANAGE_MESSAGES"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);
        when(messageService.listAdminConversations(userId)).thenReturn(List.of());

        mockMvc.perform(get("/messages/admin/conversations")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void sendAdminMessageWithoutPermissionIsForbidden() throws Exception {
        Jwt jwt = jwtWithPermissions(UUID.randomUUID(), List.of());
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        mockMvc.perform(post("/messages/admin/conversations/{conversationId}/messages", UUID.randomUUID())
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"body":"Hello"}
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(messageService, messageSseService);
    }

    @Test
    void sendAdminMessageWithManagePermissionReachesController() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Jwt jwt = jwtWithPermissions(userId, List.of("CAN_MANAGE_MESSAGES"));
        when(jwtDecoder.decode("token")).thenReturn(jwt);

        MessageConversationDTO conversation = new MessageConversationDTO();
        conversation.setConversationId(conversationId.toString());
        when(messageService.sendAdminMessage(eq(userId), eq(conversationId), org.mockito.ArgumentMatchers.any()))
                .thenReturn(conversation);

        mockMvc.perform(post("/messages/admin/conversations/{conversationId}/messages", conversationId)
                        .header("Authorization", "Bearer token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"body":"Hello"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationId").value(conversationId.toString()));
    }

    private Jwt jwtWithPermissions(UUID userId, List<String> permissions) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(userId.toString())
                .claim("userId", userId.toString())
                .claim("permissions", permissions)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(900))
                .build();
    }
}
