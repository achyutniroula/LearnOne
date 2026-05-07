package com.learnone.dto;

import java.time.OffsetDateTime;

public record ReviewDueResponse(
        String conceptSlug,
        String conceptLabel,
        int intervalDays,
        int repetitions,
        OffsetDateTime nextReviewAt
) {}
