package com.learnone.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnone.entity.Curriculum;
import com.learnone.entity.LearningSession;
import com.learnone.repository.CurriculumRepository;
import com.learnone.repository.LearningSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CurriculumService {

    private final CurriculumRepository curriculumRepo;
    private final LearningSessionRepository sessionRepo;
    private final ClaudeService claudeService;
    private final PromptBuilder promptBuilder;
    private final ObjectMapper objectMapper;

    @Async
    public void generateAsync(Long sessionId) {
        try {
            LearningSession session = sessionRepo.findById(sessionId).orElseThrow();
            String prompt = promptBuilder.buildCurriculumPrompt(session.getLearningGoal());
            String json = claudeService.sendMessage(
                    List.of(new ClaudeService.Message("user", prompt)),
                    "You are a curriculum designer. Return only valid JSON.");

            // Validate it's parseable JSON
            objectMapper.readTree(json);

            Curriculum curriculum = new Curriculum();
            curriculum.setSession(session);
            curriculum.setContent(json);
            curriculumRepo.save(curriculum);
            log.info("Curriculum generated for session {}", sessionId);
        } catch (Exception e) {
            log.error("Curriculum generation failed for session {}: {}", sessionId, e.getMessage());
        }
    }

    public Optional<Curriculum> getForSession(Long sessionId) {
        return curriculumRepo.findBySessionId(sessionId);
    }

    public Curriculum getForSessionOrThrow(Long sessionId, Long userId) {
        sessionRepo.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Session not found"));
        return curriculumRepo.findBySessionId(sessionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Curriculum not ready yet"));
    }
}
