package com.learnone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnone.entity.ChatMessage;
import com.learnone.entity.KnowledgeNode;
import com.learnone.entity.UserMemory;
import com.learnone.repository.ChatMessageRepository;
import com.learnone.repository.KnowledgeNodeRepository;
import com.learnone.repository.UserMemoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MemoryExtractionService {

    private static final int MAX_MEMORIES_PER_USER = 50;

    private final ClaudeService claudeService;
    private final UserMemoryRepository memoryRepo;
    private final KnowledgeNodeRepository nodeRepo;
    private final ChatMessageRepository chatMessageRepo;
    private final PromptBuilder promptBuilder;
    private final ObjectMapper objectMapper;
    private final EmbeddingService embeddingService;
    private final SpacedRepetitionService spacedRepService;

    @Async("extractionExecutor")
    public void extractAsync(Long userId, Long sessionId, String userMessage, String assistantReply) {
        try {
            List<String> existingKeys = memoryRepo
                    .findTop10ByUserIdOrderByConfidenceDescUpdatedAtDesc(userId)
                    .stream().map(UserMemory::getKey).toList();

            String prompt = promptBuilder.buildExtractionPrompt(userMessage, assistantReply, existingKeys);
            String raw = claudeService.sendMessage(
                    List.of(new ClaudeService.Message("user", prompt)),
                    "You are a learner-modeling extractor. Output ONLY valid JSON, no prose, no markdown.");

            JsonNode root = parseJson(raw);
            if (root == null) {
                log.warn("Memory extraction returned unparseable JSON for userId={}", userId);
                return;
            }

            persistMemories(userId, sessionId, root.path("memories"));
            persistConcepts(userId, sessionId, root.path("concepts"));
            embedLastMessages(sessionId, userMessage, assistantReply);
        } catch (Exception e) {
            log.warn("Memory extraction failed for userId={}: {}", userId, e.getMessage());
        }
    }

    private void embedLastMessages(Long sessionId, String userMessage, String assistantReply) {
        try {
            String combined = "User: " + userMessage + "\nAssistant: " + assistantReply;
            float[] embedding = embeddingService.embed(combined);
            if (embedding == null) return;
            chatMessageRepo.findTopBySessionIdAndRoleOrderByCreatedAtDesc(sessionId, ChatMessage.Role.ASSISTANT)
                    .ifPresent(msg -> {
                        msg.setEmbedding(embedding);
                        chatMessageRepo.save(msg);
                    });
        } catch (Exception e) {
            log.debug("Embedding step skipped: {}", e.getMessage());
        }
    }

    private JsonNode parseJson(String raw) {
        String trimmed = raw.strip();
        // Strip markdown code fences if present
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n') + 1;
            int end = trimmed.lastIndexOf("```");
            if (end > start) trimmed = trimmed.substring(start, end).strip();
        }
        try {
            return objectMapper.readTree(trimmed);
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional
    void persistMemories(Long userId, Long sessionId, JsonNode memoriesNode) {
        if (!memoriesNode.isArray()) return;
        for (JsonNode m : memoriesNode) {
            try {
                String key = m.path("key").asText("").strip();
                String value = m.path("value").asText("").strip();
                String category = m.path("category").asText("general").strip();
                short confidence = (short) Math.max(0, Math.min(100, m.path("confidence").asInt(50)));
                if (key.isBlank() || value.isBlank()) continue;

                UserMemory memory = memoryRepo.findByUserIdAndKey(userId, key).orElseGet(() -> {
                    UserMemory nm = new UserMemory();
                    nm.setUserId(userId);
                    nm.setKey(key);
                    return nm;
                });
                memory.setValue(value);
                memory.setCategory(category);
                memory.setConfidence((short) Math.max(memory.getConfidence(), confidence));
                memory.setSourceSessionId(sessionId);
                memory.setUpdatedAt(OffsetDateTime.now());
                memoryRepo.save(memory);

                // Evict lowest-confidence entry if over cap
                if (memoryRepo.countByUserId(userId) > MAX_MEMORIES_PER_USER) {
                    UserMemory oldest = memoryRepo.findFirstByUserIdOrderByConfidenceAscUpdatedAtAsc(userId);
                    if (oldest != null) memoryRepo.delete(oldest);
                }
            } catch (Exception e) {
                log.warn("Failed to persist memory entry: {}", e.getMessage());
            }
        }
    }

    @Transactional
    void persistConcepts(Long userId, Long sessionId, JsonNode conceptsNode) {
        if (!conceptsNode.isArray()) return;
        for (JsonNode c : conceptsNode) {
            try {
                String label = c.path("label").asText("").strip();
                int incoming = Math.max(0, Math.min(100, c.path("mastery").asInt(0)));
                if (label.isBlank()) continue;

                String slug = label.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
                if (slug.isBlank()) continue;

                KnowledgeNode node = nodeRepo.findByUserIdAndConceptSlug(userId, slug).orElseGet(() -> {
                    KnowledgeNode nn = new KnowledgeNode();
                    nn.setUserId(userId);
                    nn.setConceptSlug(slug);
                    nn.setConceptLabel(label);
                    nn.setMastery((short) 0);
                    nn.setExposures(0);
                    return nn;
                });
                // EMA: new = round(0.6*old + 0.4*incoming)
                int updated = (int) Math.round(0.6 * node.getMastery() + 0.4 * incoming);
                node.setMastery((short) Math.max(0, Math.min(100, updated)));
                node.setExposures(node.getExposures() + 1);
                node.setLastSessionId(sessionId);
                node.setUpdatedAt(OffsetDateTime.now());
                nodeRepo.save(node);
                spacedRepService.initIfAbsent(userId, slug, label);
            } catch (Exception e) {
                log.warn("Failed to persist concept entry: {}", e.getMessage());
            }
        }
    }
}
