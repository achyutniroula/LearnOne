package com.learnone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
@Slf4j
public class ClaudeService {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-opus-4-7";
    private static final int MAX_TOKENS = 4096;
    private static final int MAX_RETRIES = 3;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;

    public ClaudeService(RestTemplate restTemplate,
                         ObjectMapper objectMapper,
                         @Value("${anthropic.api.key}") String apiKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
    }

    public record Message(String role, String content) {}

    public String sendMessage(List<Message> history, String systemPrompt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", MODEL);
        body.put("max_tokens", MAX_TOKENS);
        body.put("system", systemPrompt);

        ArrayNode messages = body.putArray("messages");
        for (Message m : history) {
            ObjectNode msg = messages.addObject();
            msg.put("role", m.role());
            msg.put("content", m.content());
        }

        HttpEntity<String> request;
        try {
            request = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize Claude request", e);
        }

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                ResponseEntity<String> response = restTemplate.postForEntity(API_URL, request, String.class);
                JsonNode root = objectMapper.readTree(response.getBody());
                return root.path("content").get(0).path("text").asText();
            } catch (Exception e) {
                log.warn("Claude API attempt {}/{} failed: {}", attempt, MAX_RETRIES, e.getMessage());
                if (attempt == MAX_RETRIES) throw new RuntimeException("Claude API unavailable after retries", e);
                sleep(1000L * attempt);
            }
        }
        throw new IllegalStateException("unreachable");
    }

    private void sleep(long ms) {
        try { Thread.sleep(ms); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
    }
}
