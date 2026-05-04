package com.learnone.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnone.dto.LoginRequest;
import com.learnone.dto.RegisterRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    private static final String TEST_EMAIL = "test_" + System.currentTimeMillis() + "@learnone.test";
    private static final String TEST_PASSWORD = "Password123!";

    @Test
    void registerAndLoginFlow() throws Exception {
        // Register
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new RegisterRequest(TEST_EMAIL, TEST_PASSWORD))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.email").value(TEST_EMAIL));

        // Login
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest(TEST_EMAIL, TEST_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn();

        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("token").asText();
        assertThat(token).isNotBlank();

        // Access protected endpoint with token
        mockMvc.perform(get("/api/user/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(TEST_EMAIL));
    }

    @Test
    void protectedEndpointReturns401WithoutToken() throws Exception {
        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isUnauthorized());
    }
}
