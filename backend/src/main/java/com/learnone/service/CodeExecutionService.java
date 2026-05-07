package com.learnone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@Slf4j
public class CodeExecutionService {

    // Judge0 CE via RapidAPI — free tier: 100 submissions/day
    private static final String JUDGE0_URL =
            "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String rapidApiKey;

    public CodeExecutionService(RestTemplate restTemplate,
                                ObjectMapper objectMapper,
                                @Value("${judge0.rapidapi.key:}") String rapidApiKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.rapidApiKey = rapidApiKey;
    }

    public record Result(String stdout, String stderr, String status, int exitCode) {}

    public Result execute(String sourceCode, int languageId) {
        if (rapidApiKey == null || rapidApiKey.isBlank()) {
            return new Result(null, "Judge0 API key not configured.", "Not Configured", -1);
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-RapidAPI-Key", rapidApiKey);
            headers.set("X-RapidAPI-Host", "judge0-ce.p.rapidapi.com");

            ObjectNode body = objectMapper.createObjectNode();
            body.put("source_code", sourceCode);
            body.put("language_id", languageId);

            HttpEntity<String> req = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> res = restTemplate.postForEntity(JUDGE0_URL, req, String.class);
            JsonNode root = objectMapper.readTree(res.getBody());

            return new Result(
                    root.path("stdout").asText(null),
                    root.path("stderr").asText(null),
                    root.path("status").path("description").asText("Unknown"),
                    root.path("exit_code").asInt(0)
            );
        } catch (Exception e) {
            log.warn("Code execution failed: {}", e.getMessage());
            return new Result(null, e.getMessage(), "Error", -1);
        }
    }
}
