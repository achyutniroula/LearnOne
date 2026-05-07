package com.learnone.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.learnone.entity.Quiz;
import com.learnone.entity.QuizQuestion;
import com.learnone.repository.QuizRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuizService {

    private final ClaudeService claudeService;
    private final QuizRepository quizRepo;
    private final LearningSessionService sessionService;
    private final ObjectMapper objectMapper;

    @Transactional
    public Quiz generateOrGet(Long sessionId, Long userId) {
        return quizRepo.findBySessionId(sessionId).orElseGet(() -> generate(sessionId, userId));
    }

    private Quiz generate(Long sessionId, Long userId) {
        var session = sessionService.getSessionForUser(sessionId, userId);
        String prompt = """
                Based on a learning session with goal: "%s"

                Generate 5 quiz questions as JSON (no markdown, no prose):
                {
                  "questions": [
                    {
                      "question": "...",
                      "type": "MCQ",
                      "choices": ["Option A", "Option B", "Option C", "Option D"],
                      "correct_answer": "Option A",
                      "explanation": "..."
                    }
                  ]
                }
                Use a mix of MCQ and SHORT_ANSWER types.
                For SHORT_ANSWER omit the choices field.
                """.formatted(session.getLearningGoal());

        String raw = claudeService.sendMessage(
                List.of(new ClaudeService.Message("user", prompt)),
                "You are a quiz generator. Output ONLY valid JSON.");

        return parseAndSave(sessionId, raw);
    }

    private Quiz parseAndSave(Long sessionId, String raw) {
        String trimmed = raw.strip();
        if (trimmed.startsWith("```")) {
            int start = trimmed.indexOf('\n') + 1;
            int end = trimmed.lastIndexOf("```");
            if (end > start) trimmed = trimmed.substring(start, end).strip();
        }
        try {
            JsonNode root = objectMapper.readTree(trimmed);
            JsonNode qs = root.path("questions");

            Quiz quiz = new Quiz();
            quiz.setSessionId(sessionId);

            List<QuizQuestion> questions = new ArrayList<>();
            short order = 0;
            for (JsonNode q : qs) {
                QuizQuestion qq = new QuizQuestion();
                qq.setQuiz(quiz);
                qq.setQuestion(q.path("question").asText());
                qq.setType(q.path("type").asText("MCQ"));
                qq.setCorrectAnswer(q.path("correct_answer").asText());
                qq.setExplanation(q.path("explanation").asText(null));
                qq.setSortOrder(order++);
                if (q.has("choices")) {
                    List<String> choices = new ArrayList<>();
                    for (JsonNode c : q.path("choices")) choices.add(c.asText());
                    qq.setChoices(choices);
                }
                questions.add(qq);
            }
            quiz.setQuestions(questions);
            return quizRepo.save(quiz);
        } catch (Exception e) {
            log.warn("Quiz parse failed: {}", e.getMessage());
            Quiz empty = new Quiz();
            empty.setSessionId(sessionId);
            return quizRepo.save(empty);
        }
    }
}
