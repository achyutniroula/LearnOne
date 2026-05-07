package com.learnone.dto;

public record ProgressResponse(
        int totalConcepts,
        int masteredCount,
        int learningCount,
        int strugglingCount,
        double averageMastery,
        int reviewsDue
) {}
