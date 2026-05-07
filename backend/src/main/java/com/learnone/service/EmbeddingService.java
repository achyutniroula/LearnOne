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

@Service
@Slf4j
public class EmbeddingService {

    private static final String COHERE_URL = "https://api.cohere.com/v2/embed";
    private static final String MODEL = "embed-english-v3.0";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String cohereKey;

    public EmbeddingService(RestTemplate restTemplate,
                            ObjectMapper objectMapper,
                            @Value("${cohere.api.key:}") String cohereKey) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.cohereKey = cohereKey;
    }

    public float[] embed(String text) {
        if (cohereKey == null || cohereKey.isBlank()) return null;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(cohereKey);

            ObjectNode body = objectMapper.createObjectNode();
            body.put("model", MODEL);
            body.put("input_type", "search_document");
            ArrayNode types = body.putArray("embedding_types");
            types.add("float");
            ArrayNode texts = body.putArray("texts");
            texts.add(text.length() > 2048 ? text.substring(0, 2048) : text);

            HttpEntity<String> req = new HttpEntity<>(objectMapper.writeValueAsString(body), headers);
            ResponseEntity<String> res = restTemplate.postForEntity(COHERE_URL, req, String.class);
            JsonNode root = objectMapper.readTree(res.getBody());
            JsonNode floatArr = root.path("embeddings").path("float").get(0);
            float[] result = new float[floatArr.size()];
            for (int i = 0; i < floatArr.size(); i++) result[i] = (float) floatArr.get(i).asDouble();
            return result;
        } catch (Exception e) {
            log.debug("Embedding skipped: {}", e.getMessage());
            return null;
        }
    }
}
