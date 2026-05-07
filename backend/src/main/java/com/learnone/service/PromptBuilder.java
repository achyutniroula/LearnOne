package com.learnone.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PromptBuilder {

    @Value("${learnone.prompt.base}")
    private String basePrompt;

    public String buildSystemPrompt(String userEmail, String learningGoal, String curriculumJson) {
        return buildSystemPrompt(userEmail, learningGoal, curriculumJson, "");
    }

    public String buildSystemPrompt(String userEmail, String learningGoal, String curriculumJson, String memoryBlock) {
        return buildSystemPrompt(userEmail, learningGoal, curriculumJson, memoryBlock, "");
    }

    public String buildSystemPrompt(String userEmail, String learningGoal, String curriculumJson,
                                    String memoryBlock, String lastSessionContext) {
        String curriculum = (curriculumJson != null && !curriculumJson.isBlank())
                ? "\n\nCurrent curriculum:\n" + curriculumJson
                : "";
        String memory = (memoryBlock != null && !memoryBlock.isBlank()) ? memoryBlock : "";
        String last = (lastSessionContext != null && !lastSessionContext.isBlank()) ? lastSessionContext : "";

        return basePrompt
                .replace("{{user_email}}", userEmail)
                .replace("{{learning_goal}}", learningGoal)
                .replace("{{curriculum}}", curriculum)
                .replace("{{memory}}", memory + last);
    }

    public String buildCurriculumPrompt(String learningGoal) {
        return """
                Generate a step-by-step learning curriculum for the following goal: "%s"

                Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
                {
                  "title": "short curriculum title",
                  "phases": [
                    {
                      "name": "Phase name",
                      "topics": ["topic1", "topic2", "topic3"]
                    }
                  ]
                }
                """.formatted(learningGoal);
    }

    public String buildSummaryPrompt(String conversationText) {
        return """
                Summarize the following learning conversation into 3-5 bullet points.
                Capture the key concepts explained, questions asked, and progress made.
                Be concise — this summary will be used as context for future messages.

                Conversation:
                %s
                """.formatted(conversationText);
    }

    public String buildExtractionPrompt(String userMessage, String assistantReply, List<String> existingKeys) {
        String existing = existingKeys.isEmpty() ? "none" : String.join(", ", existingKeys);
        return """
                Analyze this learning exchange and extract insights.

                Existing memory keys (update these instead of creating duplicates): %s

                Exchange:
                User: %s
                Assistant: %s

                Return ONLY valid JSON (no markdown, no prose):
                {
                  "memories": [
                    {"key": "short-kebab-case-key", "category": "struggle|style|background|misconception|preference", "value": "concise fact about learner", "confidence": 70}
                  ],
                  "concepts": [
                    {"slug": "concept-slug", "label": "Concept Label", "mastery": 65}
                  ]
                }
                Both arrays may be empty if nothing meaningful to extract.
                """.formatted(existing, userMessage, assistantReply);
    }
}
