package com.learnone.dto;

import java.util.List;

public record QuizResponse(
        Long id,
        List<QuestionDto> questions
) {
    public record QuestionDto(
            Long id,
            String question,
            String type,
            List<String> choices,
            String correctAnswer,
            String explanation
    ) {}
}
