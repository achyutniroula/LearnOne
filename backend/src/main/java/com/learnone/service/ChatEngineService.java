package com.learnone.service;

import com.learnone.entity.ChatMessage;
import com.learnone.entity.LearningSession;
import com.learnone.repository.CurriculumRepository;
import com.learnone.repository.LearningSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ChatEngineService {

    private static final int CONTEXT_MESSAGE_LIMIT = 20;
    private static final int RATE_LIMIT_PER_HOUR = 30;
    private static final Pattern VISUAL_PATTERN = Pattern.compile(
            "(?i)\\b(diagram|visuali[sz]e?|chart|graph|draw|show me|visually|flowchart|sequence|mindmap)\\b");

    private final ClaudeService claudeService;
    private final LearningSessionService sessionService;
    private final LearningSessionRepository sessionRepo;
    private final PromptBuilder promptBuilder;
    private final RedisService redisService;
    private final CurriculumRepository curriculumRepo;
    private final MemoryContextService memoryContextService;
    private final MemoryExtractionService memoryExtractionService;

    public record ChatResult(String reply, String diagramCode) {}

    public ChatResult chat(Long sessionId, Long userId, String userEmail,
                           String userMessage, String imageData, String imageMediaType) {
        enforceRateLimit(userId);

        LearningSession session = sessionService.getSessionForUser(sessionId, userId);
        sessionService.addMessage(sessionId, ChatMessage.Role.USER, userMessage, imageData, imageMediaType);

        List<ChatMessage> history = sessionService.getHistory(sessionId);
        List<ClaudeService.Message> claudeHistory = buildClaudeHistory(history, sessionId);

        String curriculumJson = curriculumRepo.findBySessionId(sessionId)
                .map(c -> c.getContent()).orElse(null);

        String memoryBlock = memoryContextService.buildBlock(userId);
        String lastSessionContext = buildLastSessionContext(userId, sessionId);
        String systemPrompt = promptBuilder.buildSystemPrompt(
                userEmail, session.getLearningGoal(), curriculumJson, memoryBlock, lastSessionContext);

        String reply = claudeService.sendMessage(claudeHistory, systemPrompt);
        sessionService.addMessage(sessionId, ChatMessage.Role.ASSISTANT, reply);
        memoryExtractionService.extractAsync(userId, sessionId, userMessage, reply);

        String diagramCode = null;
        if (VISUAL_PATTERN.matcher(userMessage).find()) {
            diagramCode = generateDiagram(reply);
        }

        return new ChatResult(reply, diagramCode);
    }

    public ChatResult chat(Long sessionId, Long userId, String userEmail, String userMessage) {
        return chat(sessionId, userId, userEmail, userMessage, null, null);
    }

    private String generateDiagram(String teachingReply) {
        String prompt = """
                Based on this teaching response:

                %s

                Generate a Mermaid.js diagram visualizing the key concept.
                Output ONLY the raw Mermaid code (e.g. starting with 'graph TD', 'flowchart LR', 'sequenceDiagram', etc.).
                No markdown fences. No explanation.
                """.formatted(teachingReply);
        try {
            String code = claudeService.sendMessage(
                    List.of(new ClaudeService.Message("user", prompt)),
                    "You are a Mermaid.js diagram generator. Output only valid Mermaid diagram code.");
            return code.strip();
        } catch (Exception e) {
            return null;
        }
    }

    private String buildLastSessionContext(Long userId, Long currentSessionId) {
        return sessionRepo.findTop2ByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(s -> !s.getId().equals(currentSessionId))
                .findFirst()
                .map(s -> "\n\nPrevious session: " + s.getLearningGoal() + " — build on that context.")
                .orElse("");
    }

    private List<ClaudeService.Message> buildClaudeHistory(List<ChatMessage> history, Long sessionId) {
        List<ChatMessage> relevant = history.stream()
                .filter(m -> m.getRole() != ChatMessage.Role.SYSTEM)
                .toList();

        if (relevant.size() > CONTEXT_MESSAGE_LIMIT) {
            List<ChatMessage> old = relevant.subList(0, relevant.size() - CONTEXT_MESSAGE_LIMIT);
            List<ChatMessage> recent = relevant.subList(relevant.size() - CONTEXT_MESSAGE_LIMIT, relevant.size());

            StringBuilder oldText = new StringBuilder();
            for (ChatMessage m : old) {
                oldText.append(m.getRole()).append(": ").append(m.getContent()).append("\n");
            }
            String summary = claudeService.sendMessage(
                    List.of(new ClaudeService.Message("user", promptBuilder.buildSummaryPrompt(oldText.toString()))),
                    "You are a helpful assistant that summarizes conversations concisely.");

            List<ClaudeService.Message> result = new ArrayList<>();
            result.add(new ClaudeService.Message("user", "[Earlier conversation summary]\n" + summary));
            result.add(new ClaudeService.Message("assistant", "Understood. I'll continue from where we left off."));
            for (ChatMessage m : recent) {
                result.add(new ClaudeService.Message(
                        m.getRole().name().toLowerCase(),
                        m.getContent(),
                        m.getImageData(),
                        m.getImageMediaType()));
            }
            return result;
        }

        return relevant.stream()
                .map(m -> new ClaudeService.Message(
                        m.getRole().name().toLowerCase(),
                        m.getContent(),
                        m.getImageData(),
                        m.getImageMediaType()))
                .toList();
    }

    private void enforceRateLimit(Long userId) {
        String key = "learnone:rate:" + userId + ":messages";
        Long count = redisService.increment(key);
        if (count == 1) redisService.expire(key, Duration.ofHours(1));
        if (count > RATE_LIMIT_PER_HOUR) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Rate limit exceeded: max " + RATE_LIMIT_PER_HOUR + " messages per hour");
        }
    }
}
