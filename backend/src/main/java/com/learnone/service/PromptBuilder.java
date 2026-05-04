package com.learnone.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PromptBuilder {

    @Value("${learnone.prompt.base}")
    private String basePrompt;

    public String buildSystemPrompt(String userEmail, String learningGoal, String curriculumJson) {
        String curriculum = (curriculumJson != null && !curriculumJson.isBlank())
                ? "\n\nCurrent curriculum:\n" + curriculumJson
                : "";

        return basePrompt
                .replace("{{user_email}}", userEmail)
                .replace("{{learning_goal}}", learningGoal)
                .replace("{{curriculum}}", curriculum);
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
}
