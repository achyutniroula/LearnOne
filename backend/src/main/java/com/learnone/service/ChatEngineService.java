package com.learnone.service;

import com.learnone.entity.ChatMessage;
import com.learnone.entity.LearningSession;
import com.learnone.repository.CurriculumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatEngineService {

    private static final int CONTEXT_MESSAGE_LIMIT = 20;
    private static final int RATE_LIMIT_PER_HOUR = 30;

    private final ClaudeService claudeService;
    private final LearningSessionService sessionService;
    private final PromptBuilder promptBuilder;
    private final RedisService redisService;
    private final CurriculumRepository curriculumRepo;

    public String chat(Long sessionId, Long userId, String userEmail, String userMessage) {
        enforceRateLimit(userId);

        LearningSession session = sessionService.getSessionForUser(sessionId, userId);
        sessionService.addMessage(sessionId, ChatMessage.Role.USER, userMessage);

        List<ChatMessage> history = sessionService.getHistory(sessionId);
        List<ClaudeService.Message> claudeHistory = buildClaudeHistory(history, sessionId);

        String curriculumJson = curriculumRepo.findBySessionId(sessionId)
                .map(c -> c.getContent())
                .orElse(null);

        String systemPrompt = promptBuilder.buildSystemPrompt(userEmail, session.getLearningGoal(), curriculumJson);
        String reply = claudeService.sendMessage(claudeHistory, systemPrompt);

        sessionService.addMessage(sessionId, ChatMessage.Role.ASSISTANT, reply);
        return reply;
    }

    private List<ClaudeService.Message> buildClaudeHistory(List<ChatMessage> history, Long sessionId) {
        List<ChatMessage> relevant = history.stream()
                .filter(m -> m.getRole() != ChatMessage.Role.SYSTEM)
                .toList();

        if (relevant.size() > CONTEXT_MESSAGE_LIMIT) {
            // Summarize older messages, keep recent ones
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
                result.add(new ClaudeService.Message(m.getRole().name().toLowerCase(), m.getContent()));
            }
            return result;
        }

        return relevant.stream()
                .map(m -> new ClaudeService.Message(m.getRole().name().toLowerCase(), m.getContent()))
                .toList();
    }

    private void enforceRateLimit(Long userId) {
        String key = "learnone:rate:" + userId + ":messages";
        Long count = redisService.increment(key);
        if (count == 1) {
            redisService.expire(key, Duration.ofHours(1));
        }
        if (count > RATE_LIMIT_PER_HOUR) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Rate limit exceeded: max " + RATE_LIMIT_PER_HOUR + " messages per hour");
        }
    }
}
